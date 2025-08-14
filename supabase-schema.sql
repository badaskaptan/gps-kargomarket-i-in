-- GPS Backend için Supabase tabloları (Master Database - Production Ready)
-- Versiyon: 2.0 - Düzeltilmiş ve optimize edilmiş

-- 1. Görevler tablosu (Kargomarketing + GPS ortak kullanımı)
CREATE TABLE IF NOT EXISTS public.gorevler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kargomarketing alanları (INSERT yetkisi)
  ilan_no VARCHAR(50) UNIQUE NOT NULL,
  tc_kimlik VARCHAR(11) NOT NULL,           -- Kargomarketing'den gelen TC
  sofor_adi VARCHAR(100) NOT NULL,          -- Kargomarketing'den gelen ad soyad
  musteri_bilgisi TEXT,
  ilan_aciklama TEXT,
  teslimat_adresi TEXT NOT NULL,
  baslangic_adresi TEXT,
  
  -- GPS Backend alanları (Trigger + Mobile App)
  sofor_id UUID REFERENCES auth.users(id), -- Trigger ile eşleştirme sonrası
  kabul_edildi_mi BOOLEAN DEFAULT FALSE,    -- Mobile app ile şoför kabulü
  son_konum_lat DECIMAL(10,8),             -- GPS tracking'den
  son_konum_lng DECIMAL(11,8),             -- GPS tracking'den
  
  -- Ortak durum alanları
  sefer_durumu VARCHAR(20) DEFAULT 'beklemede',
  durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor',
  
  -- Timestamp alanları
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. GPS kayıtları tablosu (Sadece GPS Backend)
CREATE TABLE IF NOT EXISTS public.gps_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gorev_id UUID REFERENCES public.gorevler(id) ON DELETE CASCADE,
  sofor_id UUID REFERENCES auth.users(id) NOT NULL,
  
  -- GPS koordinat verileri
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  hiz DECIMAL(5,2) DEFAULT 0,              -- km/saat
  yon INTEGER DEFAULT 0,                   -- derece (0-360)
  dogruluk DECIMAL(5,2) DEFAULT 0,         -- metre cinsinden
  
  -- Ek GPS verileri (opsiyonel)
  konum_verisi JSONB,                      -- Ekstra GPS metadata
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Şöför profilleri tablosu (Sadece GPS Backend)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Temel şoför bilgileri
  ad VARCHAR(50) NOT NULL,
  soyad VARCHAR(50) NOT NULL,
  tam_ad VARCHAR(100) GENERATED ALWAYS AS (CONCAT(ad, ' ', soyad)) STORED,
  
  -- İletişim bilgileri
  telefon VARCHAR(15),
  email VARCHAR(255),
  
  -- Araç bilgileri
  plaka VARCHAR(10),
  
  -- Eşleştirme için kritik alan
  tc_kimlik VARCHAR(11) UNIQUE NOT NULL,
  
  -- Durum bilgisi
  aktif BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Admin log tablosu (Eşleşmeyen durumlar için)
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type VARCHAR(50) NOT NULL,           -- 'driver_not_found', 'multiple_match', etc.
  ilan_no VARCHAR(50),
  tc_kimlik VARCHAR(11),
  sofor_adi VARCHAR(100),
  error_details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) ayarları
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri temizle (varsa)
DROP POLICY IF EXISTS "Şoförler kendi görevlerini görebilir" ON public.gorevler;
DROP POLICY IF EXISTS "Şoförler görev kabul edebilir" ON public.gorevler;
DROP POLICY IF EXISTS "Şoförler kendi GPS verilerini görebilir" ON public.gps_kayitlari;
DROP POLICY IF EXISTS "Şoförler GPS verisi ekleyebilir" ON public.gps_kayitlari;
DROP POLICY IF EXISTS "Şoförler kendi profillerini görebilir" ON public.profiles;
DROP POLICY IF EXISTS "Kargomarketing görev oluşturabilir" ON public.gorevler;
DROP POLICY IF EXISTS "Kargomarketing görevleri okuyabilir" ON public.gorevler;
DROP POLICY IF EXISTS "Kargomarketing sınırlı güncelleme" ON public.gorevler;
DROP POLICY IF EXISTS "Admin log erişimi" ON public.admin_logs;

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

-- Kargomarketing API için özel policies
CREATE POLICY "Kargomarketing görev oluşturabilir" ON public.gorevler
  FOR INSERT WITH CHECK (
    current_setting('app.user_role', true) = 'kargomarketing_api'
  );

CREATE POLICY "Kargomarketing görevleri okuyabilir" ON public.gorevler
  FOR SELECT USING (
    current_setting('app.user_role', true) = 'kargomarketing_api'
  );

CREATE POLICY "Kargomarketing sınırlı güncelleme" ON public.gorevler
  FOR UPDATE USING (
    current_setting('app.user_role', true) = 'kargomarketing_api'
    AND sofor_id IS NULL  -- Sadece henüz atanmamış görevler
    AND durum IN ('eslesme_bekleniyor', 'sofor_bulunamadi')
  );

-- Admin policies (log tablosu için)
CREATE POLICY "Admin log erişimi" ON public.admin_logs
  FOR ALL USING (
    current_setting('app.user_role', true) = 'admin'
  );

-- İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_gorevler_tc_kimlik ON public.gorevler(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor_id ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(durum);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_kimlik ON public.profiles(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON public.profiles(aktif);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_gorev_id ON public.gps_kayitlari(gorev_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_sofor_id ON public.gps_kayitlari(sofor_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_resolved ON public.admin_logs(resolved);

-- Mevcut trigger'ları ve function'ları temizle (varsa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_new_task_assign ON public.gorevler;
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari;
DROP TRIGGER IF EXISTS on_task_status_change ON public.gorevler;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.match_driver_by_tc(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.auto_assign_driver();
DROP FUNCTION IF EXISTS public.authenticate_kargomarketing_api(VARCHAR);
DROP FUNCTION IF EXISTS public.update_gps_tracking();
DROP FUNCTION IF EXISTS public.notify_task_status_change();

-- Trigger: profiles tablosuna otomatik kayıt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, ad, soyad, tc_kimlik, aktif)
  VALUES (NEW.id, 'Yeni', 'Şoför', '00000000000', false);
  -- Yeni şoförler başlangıçta pasif, admin onayı sonrası aktif
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: TC Kimlik ile şoför eşleştirme (Geliştirilmiş)
CREATE OR REPLACE FUNCTION public.match_driver_by_tc(
  tc_kimlik_param VARCHAR(11),
  sofor_adi_param VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
  matched_sofor_id UUID;
  profile_count INTEGER;
  current_name VARCHAR(100);
BEGIN
  -- TC kimlik formatı kontrolü
  IF LENGTH(tc_kimlik_param) != 11 OR tc_kimlik_param ~ '[^0-9]' THEN
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('invalid_tc', tc_kimlik_param, sofor_adi_param, 
            json_build_object('message', 'Geçersiz TC kimlik formatı'));
    RETURN NULL;
  END IF;
  
  -- Aktif şoför sayısını kontrol et
  SELECT COUNT(*) INTO profile_count
  FROM public.profiles 
  WHERE tc_kimlik = tc_kimlik_param 
    AND aktif = TRUE;
    
  -- Tek eşleşme varsa
  IF profile_count = 1 THEN
    SELECT id, tam_ad INTO matched_sofor_id, current_name
    FROM public.profiles 
    WHERE tc_kimlik = tc_kimlik_param 
      AND aktif = TRUE;
      
    -- İsim farklıysa güncelle
    IF LOWER(current_name) != LOWER(sofor_adi_param) THEN
      UPDATE public.profiles 
      SET ad = SPLIT_PART(sofor_adi_param, ' ', 1),
          soyad = COALESCE(NULLIF(SPLIT_PART(sofor_adi_param, ' ', 2), ''), 'UNKNOWN')
      WHERE id = matched_sofor_id;
    END IF;
    
    RETURN matched_sofor_id;
    
  -- Hiç eşleşme yoksa log kaydet
  ELSIF profile_count = 0 THEN
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('driver_not_found', tc_kimlik_param, sofor_adi_param, 
            json_build_object('message', 'TC kimlik sistemde bulunamadı'));
    
  -- Birden fazla eşleşme varsa log kaydet
  ELSE
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('multiple_matches', tc_kimlik_param, sofor_adi_param,
            json_build_object('count', profile_count, 'message', 'Birden fazla aktif şoför bulundu'));
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Yeni görev geldiğinde otomatik eşleştirme (Geliştirilmiş)
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  matched_driver_id UUID;
BEGIN
  -- Şoför eşleştirme
  matched_driver_id := public.match_driver_by_tc(NEW.tc_kimlik, NEW.sofor_adi);
  
  IF matched_driver_id IS NOT NULL THEN
    NEW.sofor_id := matched_driver_id;
    NEW.durum := 'atandi';
  ELSE
    -- match_driver_by_tc function'ı zaten log kaydetti
    NEW.durum := 'sofor_bulunamadi';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();

-- Function: Kargomarketing API kimlik doğrulama (Geliştirilmiş)
CREATE OR REPLACE FUNCTION public.authenticate_kargomarketing_api(
  api_key VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- API key kontrolü (production'da çok daha güvenli olmalı)
  IF api_key = 'KARGOMARKETING_SECRET_KEY_2025' THEN
    PERFORM set_config('app.user_role', 'kargomarketing_api', true);
    RETURN TRUE;
  END IF;
  
  -- Başarısız giriş denemesi logla
  INSERT INTO public.admin_logs (log_type, error_details)
  VALUES ('failed_api_auth', json_build_object('attempted_key', LEFT(api_key, 10)));
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: GPS kayıt güncellemesi
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS trigger AS $$
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
  FOR EACH ROW EXECUTE PROCEDURE public.update_gps_tracking();

-- Trigger: Real-time bildirimler (Geliştirilmiş)
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Real-time subscription için kapsamlı bildirim gönder
  PERFORM pg_notify('task_status_changed', 
    json_build_object(
      'event_type', 'task_update',
      'gorev_id', NEW.id,
      'ilan_no', NEW.ilan_no,
      'durum', NEW.durum,
      'sofor_id', NEW.sofor_id,
      'kabul_edildi', NEW.kabul_edildi_mi,
      'tc_kimlik', NEW.tc_kimlik,
      'son_konum', CASE 
        WHEN NEW.son_konum_lat IS NOT NULL 
        THEN json_build_object('lat', NEW.son_konum_lat, 'lng', NEW.son_konum_lng)
        ELSE NULL 
      END,
      'timestamp', NEW.updated_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_status_change
  AFTER UPDATE ON public.gorevler
  FOR EACH ROW 
  WHEN (
    OLD.durum IS DISTINCT FROM NEW.durum OR 
    OLD.kabul_edildi_mi IS DISTINCT FROM NEW.kabul_edildi_mi OR
    OLD.son_konum_lat IS DISTINCT FROM NEW.son_konum_lat OR
    OLD.son_konum_lng IS DISTINCT FROM NEW.son_konum_lng
  )
  EXECUTE FUNCTION public.notify_task_status_change();
