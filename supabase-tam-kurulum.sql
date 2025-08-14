-- ========================================
-- GPS Takip Sistemi - Tamamlanmış SQL Setup
-- Supabase SQL Editor'da çalıştırın
-- ========================================

-- 1. PROFILES TABLOSUNA EKSİK KOLONLARI EKLE
-- ========================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telefon VARCHAR(15),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'beklemede';

-- 2. APP_CONFIG TABLOSUNDAKİ API KEY'İ AYARLA
-- ========================================

INSERT INTO public.app_config (key, value)
VALUES ('km_api_key', 'NERELİYİMSALUR')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. API AUTHENTICATION FONKSİYONU
-- ========================================

CREATE OR REPLACE FUNCTION public.authenticate_kargomarketing_api(
  api_key text
)
RETURNS boolean AS $$
DECLARE
  stored_key text;
  rate_limit_count INTEGER;
BEGIN
  -- Rate limiting check (5 dakikada max 5 başarısız deneme)
  SELECT COUNT(*) INTO rate_limit_count 
  FROM public.admin_logs 
  WHERE 
    log_type = 'failed_api_auth' AND 
    created_at > NOW() - INTERVAL '5 minutes';
  
  IF rate_limit_count > 5 THEN
    INSERT INTO public.admin_logs (log_type, error_details)
    VALUES ('rate_limit_exceeded', json_build_object(
      'attempts_in_5min', rate_limit_count,
      'blocked_at', NOW()
    ));
    RAISE EXCEPTION 'Rate limit exceeded: Too many authentication attempts';
  END IF;

  -- API key kontrolü
  SELECT value INTO stored_key 
  FROM public.app_config 
  WHERE key = 'km_api_key';
  
  IF api_key = stored_key THEN
    PERFORM set_config('app.user_role', 'kargomarketing_api', true);
    
    -- Başarılı giriş logu
    INSERT INTO public.admin_logs (log_type, error_details)
    VALUES ('successful_api_auth', json_build_object(
      'timestamp', NOW(),
      'session_role', 'kargomarketing_api'
    ));
    
    RETURN TRUE;
  END IF;
  
  -- Başarısız giriş logu
  INSERT INTO public.admin_logs (log_type, error_details)
  VALUES ('failed_api_auth', json_build_object(
    'attempted_key', LEFT(api_key, 10),
    'timestamp', NOW(),
    'rate_limit_status', rate_limit_count + 1
  ));
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TC KİMLİK EŞLEŞTİRME FONKSİYONU
-- ========================================

-- Mevcut fonksiyonu sil (parametre adı değişikliği için)
DROP FUNCTION IF EXISTS public.match_driver_by_tc(character varying, character varying);

CREATE OR REPLACE FUNCTION public.match_driver_by_tc(
  p_tc_kimlik varchar(11),
  p_sofor_adi varchar(100)
)
RETURNS uuid AS $$
DECLARE
  driver_id uuid;
  validation_result boolean;
BEGIN
  -- TC kimlik formatı kontrolü
  IF LENGTH(p_tc_kimlik) != 11 OR p_tc_kimlik ~ '[^0-9]' THEN
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('invalid_tc_format', p_tc_kimlik, p_sofor_adi, 
            json_build_object('reason', 'TC kimlik 11 haneli sayı olmalı'));
    RETURN NULL;
  END IF;

  -- İlk hanesi 0 olamaz
  IF LEFT(p_tc_kimlik, 1) = '0' THEN
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('invalid_tc_format', p_tc_kimlik, p_sofor_adi, 
            json_build_object('reason', 'TC kimlik 0 ile başlayamaz'));
    RETURN NULL;
  END IF;

  -- Aktif profilde TC kimlik ara
  SELECT id INTO driver_id
  FROM public.profiles
  WHERE tc_kimlik = p_tc_kimlik
    AND (aktif = true OR durum = 'aktif')
  LIMIT 1;
  
  IF driver_id IS NOT NULL THEN
    -- Başarılı eşleşme logu
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('successful_tc_match', p_tc_kimlik, p_sofor_adi, 
            json_build_object('matched_driver_id', driver_id, 'timestamp', NOW()));
  ELSE
    -- Eşleşme bulunamadı logu
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('tc_not_found', p_tc_kimlik, p_sofor_adi, 
            json_build_object('reason', 'Aktif şoför profili bulunamadı', 'timestamp', NOW()));
  END IF;
  
  RETURN driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. KARGOMARKETING RPC FONKSİYONLARI
-- ========================================

-- Görev oluşturma RPC
CREATE OR REPLACE FUNCTION public.km_insert_gorev(
  api_key text,
  p_ilan_no varchar(50),
  p_tc_kimlik varchar(11), 
  p_sofor_adi varchar(100),
  p_teslimat_adresi text,
  p_musteri_bilgisi text DEFAULT NULL,
  p_baslangic_adresi text DEFAULT NULL,
  p_ilan_aciklama text DEFAULT NULL
)
RETURNS public.gorevler AS $$
DECLARE
  result_row public.gorevler%ROWTYPE;
BEGIN
  -- API key doğrulama
  IF NOT public.authenticate_kargomarketing_api(api_key) THEN
    RAISE EXCEPTION 'Unauthorized API access';
  END IF;
  
  -- Görev oluştur
  INSERT INTO public.gorevler (
    ilan_no, tc_kimlik, sofor_adi, teslimat_adresi,
    musteri_bilgisi, baslangic_adresi, ilan_aciklama, durum
  ) VALUES (
    p_ilan_no, p_tc_kimlik, p_sofor_adi, p_teslimat_adresi,
    p_musteri_bilgisi, p_baslangic_adresi, p_ilan_aciklama, 'beklemede'
  ) RETURNING * INTO result_row;
  
  -- Başarılı görev oluşturma logu
  INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
  VALUES ('task_created', p_tc_kimlik, p_sofor_adi, 
          json_build_object('ilan_no', p_ilan_no, 'gorev_id', result_row.id, 'timestamp', NOW()));
  
  RETURN result_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Görev listeleme RPC
CREATE OR REPLACE FUNCTION public.km_list_gorevler(api_key text)
RETURNS SETOF public.gorevler AS $$
BEGIN
  -- API key doğrulama
  IF NOT public.authenticate_kargomarketing_api(api_key) THEN
    RAISE EXCEPTION 'Unauthorized API access';
  END IF;
  
  -- Görevleri döndür
  RETURN QUERY 
  SELECT * FROM public.gorevler 
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. GELIŞMIŞ AUTO_ASSIGN_DRIVER TRİGGER FONKSİYONU GÜNCELLE
-- ========================================

-- Mevcut fonksiyonu sil
DROP FUNCTION IF EXISTS public.auto_assign_driver();

CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  matched_driver_id UUID;
BEGIN
  -- TC kimlik ile şoför ara
  matched_driver_id := public.match_driver_by_tc(NEW.tc_kimlik, NEW.sofor_adi);
  
  IF matched_driver_id IS NOT NULL THEN
    NEW.sofor_id := matched_driver_id;
    NEW.durum := 'atandi';
    
    -- Atama başarılı logu
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('driver_auto_assigned', NEW.tc_kimlik, NEW.sofor_adi, 
            json_build_object('driver_id', matched_driver_id, 'ilan_no', NEW.ilan_no));
  ELSE
    NEW.durum := 'sofor_bulunamadi';
    
    -- Şoför bulunamadı logu
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('driver_not_found', NEW.tc_kimlik, NEW.sofor_adi, 
            json_build_object('reason', 'Otomatik atama başarısız', 'ilan_no', NEW.ilan_no));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TC KİMLİK UNIQUE INDEX (NULL değerler için)
-- ========================================

-- Eğer varsa eski constraint'i kaldır
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tc_kimlik_key;
DROP INDEX IF EXISTS profiles_tc_kimlik_key;

-- Sadece NULL olmayan TC kimlikler için unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tc_kimlik_unique_not_null
  ON public.profiles (tc_kimlik)
  WHERE tc_kimlik IS NOT NULL AND tc_kimlik != '';

-- 8. HANDLE_NEW_USER TRİGGER FONKSİYONU GÜNCELLE
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Minimal profil oluştur - TC kimlik kullanıcı tarafından doldurulacak
  INSERT INTO public.profiles (id, ad, soyad, email, aktif, durum)
  VALUES (NEW.id, 'Profil', 'Beklemede', NEW.email, false, 'beklemede')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- KURULUM TAMAMLANDI! 
-- ========================================

-- Test için örnek sorgu:
-- SELECT * FROM public.app_config WHERE key = 'km_api_key';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles' AND table_schema = 'public';

-- Başarı mesajı
DO $$
BEGIN
  RAISE NOTICE 'GPS Takip Sistemi kurulumu tamamlandı!';
  RAISE NOTICE 'Mobil uygulama: http://localhost:8083';
  RAISE NOTICE 'API Key: NERELİYİMSALUR';
  RAISE NOTICE 'Test için Postman koleksiyonunu kullanabilirsiniz.';
END $$;
