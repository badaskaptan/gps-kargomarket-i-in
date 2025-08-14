-- GPS Backend için Supabase tabloları (Basitleştirilmiş Versiyon)

-- 1. Görevler tablosu (şoförlere atanan işler)
CREATE TABLE IF NOT EXISTS public.gorevler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ilan_no VARCHAR(50) UNIQUE NOT NULL,
  tc_kimlik VARCHAR(11) NOT NULL,           -- Kargomarketing'den gelen TC
  sofor_adi VARCHAR(100) NOT NULL,          -- Kargomarketing'den gelen ad soyad
  sofor_id UUID REFERENCES auth.users(id), -- Eşleştirme sonrası dolacak
  musteri_bilgisi TEXT,
  ilan_aciklama TEXT,
  teslimat_adresi TEXT,
  baslangic_adresi TEXT,
  sefer_durumu VARCHAR(20) DEFAULT 'beklemede',
  kabul_edildi_mi BOOLEAN DEFAULT FALSE,
  durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor', -- Yeni durum
  son_konum_lat DECIMAL(10,8),
  son_konum_lng DECIMAL(11,8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. GPS kayıtları tablosu (konum verileri)
CREATE TABLE IF NOT EXISTS public.gps_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gorev_id UUID REFERENCES public.gorevler(id),
  sofor_id UUID REFERENCES auth.users(id),
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  hiz DECIMAL(5,2),
  yon INTEGER,
  dogruluk DECIMAL(5,2),
  konum_verisi JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Şöför profilleri tablosu (kullanıcı detayları)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  ad VARCHAR(50),
  soyad VARCHAR(50),
  tam_ad VARCHAR(100) GENERATED ALWAYS AS (CONCAT(ad, ' ', soyad)) STORED,
  telefon VARCHAR(15),
  plaka VARCHAR(10),
  tc_kimlik VARCHAR(11) UNIQUE NOT NULL,    -- TC zorunlu ve unique
  email VARCHAR(255),
  aktif BOOLEAN DEFAULT TRUE,               -- Şoför aktif mi?
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) ayarları
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Şoförler sadece kendi verilerini görebilir
CREATE POLICY "Şoförler kendi görevlerini görebilir" ON public.gorevler
  FOR SELECT USING (auth.uid() = sofor_id);

-- Şoförler görev durumunu güncelleyebilir (kabul etme)
CREATE POLICY "Şoförler görev kabul edebilir" ON public.gorevler
  FOR UPDATE USING (auth.uid() = sofor_id);

CREATE POLICY "Şoförler kendi GPS verilerini görebilir" ON public.gps_kayitlari
  FOR SELECT USING (auth.uid() = sofor_id);

CREATE POLICY "Şoförler GPS verisi ekleyebilir" ON public.gps_kayitlari
  FOR INSERT WITH CHECK (auth.uid() = sofor_id);

CREATE POLICY "Şoförler kendi profillerini görebilir" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_gorevler_tc_kimlik ON public.gorevler(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor_id ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_kimlik ON public.profiles(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_gorev_id ON public.gps_kayitlari(gorev_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_sofor_id ON public.gps_kayitlari(sofor_id);

-- Trigger: profiles tablosuna otomatik kayıt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, ad, soyad, tc_kimlik)
  VALUES (NEW.id, 'Yeni', 'Şoför', '00000000000');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: TC Kimlik ile şoför eşleştirme (BASİT)
CREATE OR REPLACE FUNCTION public.match_driver_by_tc(
  tc_kimlik_param VARCHAR(11),
  sofor_adi_param VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
  matched_sofor_id UUID;
  profile_ad_soyad VARCHAR(100);
BEGIN
  -- TC ile eşleştirme yap
  SELECT id, tam_ad INTO matched_sofor_id, profile_ad_soyad
  FROM public.profiles 
  WHERE tc_kimlik = tc_kimlik_param 
    AND aktif = TRUE
  LIMIT 1;
  
  -- Eğer TC eşleşti ama ad farklıysa güncelle
  IF matched_sofor_id IS NOT NULL AND 
     LOWER(profile_ad_soyad) != LOWER(sofor_adi_param) THEN
    
    -- Profile'daki adı güncelle
    UPDATE public.profiles 
    SET ad = SPLIT_PART(sofor_adi_param, ' ', 1),
        soyad = SPLIT_PART(sofor_adi_param, ' ', 2)
    WHERE id = matched_sofor_id;
  END IF;
  
  RETURN matched_sofor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Yeni görev geldiğinde otomatik eşleştirme
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  matched_driver_id UUID;
BEGIN
  -- TC ile şoför eşleştirmeyi dene
  matched_driver_id := public.match_driver_by_tc(NEW.tc_kimlik, NEW.sofor_adi);
  
  IF matched_driver_id IS NOT NULL THEN
    -- Eşleşme bulundu, sofor_id'yi güncelle
    NEW.sofor_id := matched_driver_id;
    NEW.durum := 'atandi';
  ELSE
    -- Eşleşme bulunamadı, manuel inceleme gerekli
    NEW.durum := 'sofor_bulunamadi';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();

-- Trigger: GPS kayıt güncellemesi
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Son GPS koordinatlarını güncelle
  UPDATE public.gorevler 
  SET son_konum_lat = NEW.latitude,
      son_konum_lng = NEW.longitude,
      updated_at = now()
  WHERE id = NEW.gorev_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_gps_update
  AFTER INSERT ON public.gps_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- Trigger: Real-time bildirimler
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Real-time subscription için bildirim
  PERFORM pg_notify('task_status_changed', 
    json_build_object(
      'gorev_id', NEW.id,
      'durum', NEW.durum,
      'sofor_id', NEW.sofor_id,
      'kabul_edildi', NEW.kabul_edildi_mi,
      'ilan_no', NEW.ilan_no,
      'tc_kimlik', NEW.tc_kimlik
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_status_change
  AFTER UPDATE ON public.gorevler
  FOR EACH ROW 
  WHEN (OLD.durum IS DISTINCT FROM NEW.durum OR OLD.kabul_edildi_mi IS DISTINCT FROM NEW.kabul_edildi_mi)
  EXECUTE FUNCTION public.notify_task_status_change();
