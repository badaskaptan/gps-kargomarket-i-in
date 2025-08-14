-- HIZLI ÇÖZÜM - Sadece Eksik Parçalar
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Profiles tablosu eksik kolonlar
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefon VARCHAR(15),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'beklemede';

-- 1.1. Gorevler tablosu eksik zaman kolonları
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS baslangic_zamani TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bitis_zamani TIMESTAMPTZ;

-- 2. API key ayarla
INSERT INTO public.app_config (key, value)
VALUES ('km_api_key', 'NERELİYİMSALUR')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Eski fonksiyonları ve trigger'ları sil
DROP TRIGGER IF EXISTS on_new_task_assign ON public.gorevler;
DROP FUNCTION IF EXISTS public.match_driver_by_tc(character varying, character varying);
DROP FUNCTION IF EXISTS public.auto_assign_driver();
DROP FUNCTION IF EXISTS public.authenticate_kargomarketing_api(text);

-- 4. API authentication
CREATE OR REPLACE FUNCTION public.authenticate_kargomarketing_api(api_key text)
RETURNS boolean AS $$
DECLARE stored_key text;
BEGIN
  SELECT value INTO stored_key FROM public.app_config WHERE key = 'km_api_key';
  IF api_key = stored_key THEN
    PERFORM set_config('app.user_role', 'kargomarketing_api', true);
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TC eşleştirme
CREATE OR REPLACE FUNCTION public.match_driver_by_tc(p_tc_kimlik varchar(11), p_sofor_adi varchar(100))
RETURNS uuid AS $$
DECLARE driver_id uuid;
BEGIN
  SELECT id INTO driver_id FROM public.profiles
  WHERE tc_kimlik = p_tc_kimlik AND (aktif = true OR durum = 'aktif')
  LIMIT 1;
  RETURN driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Auto assign driver
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE matched_driver_id UUID;
BEGIN
  matched_driver_id := public.match_driver_by_tc(NEW.tc_kimlik, NEW.sofor_adi);
  IF matched_driver_id IS NOT NULL THEN
    NEW.sofor_id := matched_driver_id;
    NEW.durum := 'atandi';
  ELSE
    NEW.durum := 'sofor_bulunamadi';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. KargoMarketing RPC fonksiyonları
CREATE OR REPLACE FUNCTION public.km_insert_gorev(
  api_key text, p_ilan_no varchar(50), p_tc_kimlik varchar(11), 
  p_sofor_adi varchar(100), p_teslimat_adresi text,
  p_musteri_bilgisi text DEFAULT NULL, p_baslangic_adresi text DEFAULT NULL,
  p_ilan_aciklama text DEFAULT NULL
)
RETURNS public.gorevler AS $$
DECLARE result_row public.gorevler%ROWTYPE;
BEGIN
  IF NOT public.authenticate_kargomarketing_api(api_key) THEN
    RAISE EXCEPTION 'Unauthorized API access';
  END IF;
  INSERT INTO public.gorevler (ilan_no, tc_kimlik, sofor_adi, teslimat_adresi, musteri_bilgisi, baslangic_adresi, ilan_aciklama, durum)
  VALUES (p_ilan_no, p_tc_kimlik, p_sofor_adi, p_teslimat_adresi, p_musteri_bilgisi, p_baslangic_adresi, p_ilan_aciklama, 'beklemede')
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.km_list_gorevler(api_key text)
RETURNS SETOF public.gorevler AS $$
BEGIN
  IF NOT public.authenticate_kargomarketing_api(api_key) THEN
    RAISE EXCEPTION 'Unauthorized API access';
  END IF;
  RETURN QUERY SELECT * FROM public.gorevler ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TC kimlik unique index
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tc_kimlik_key;
DROP INDEX IF EXISTS profiles_tc_kimlik_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tc_kimlik_unique_not_null
  ON public.profiles (tc_kimlik) WHERE tc_kimlik IS NOT NULL AND tc_kimlik != '';

-- 9. Trigger'ı yeniden oluştur
CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();

-- 10. GPS Verileri Otomatik Temizlik
CREATE OR REPLACE FUNCTION public.cleanup_old_gps_data()
RETURNS void AS $$
BEGIN
  -- 30 günden eski GPS kayıtlarını sil
  DELETE FROM public.gps_kayitlari 
  WHERE timestamp < NOW() - INTERVAL '30 days';
  
  -- Tamamlanmış görevlerin 90 günden eski GPS verilerini sil
  DELETE FROM public.gps_kayitlari 
  WHERE gorev_id IN (
    SELECT id FROM public.gorevler 
    WHERE sefer_durumu = 'tamamlandi' 
    AND bitis_zamani < NOW() - INTERVAL '90 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Haftalık otomatik temizlik (cron job gerekiyor)
-- Supabase Dashboard → Extensions → pg_cron etkinleştir
-- SELECT cron.schedule('cleanup-gps', '0 2 * * 0', 'SELECT public.cleanup_old_gps_data();');

-- Başarı mesajı
SELECT 'GPS Takip Sistemi kurulumu tamamlandı!' as durum;
