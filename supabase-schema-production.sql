-- GPS Backend için Supabase tabloları (Master Database - TC Kimlik Eşleştirme)
-- Versiyon: 2.0 - Production Ready

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
  
  -- Eşleştirme için kritik alan (kayıt anında opsiyonel)
  tc_kimlik VARCHAR(11),
  
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

-- =============================================================================
-- RLS (Row Level Security) AYARLARI
-- =============================================================================

ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Şoför policies (Mobile App için)
CREATE POLICY "Şoförler kendi görevlerini görebilir" ON public.gorevler
  FOR SELECT USING (auth.uid() = sofor_id);

CREATE POLICY "Şoförler görev kabul edebilir" ON public.gorevler
  FOR UPDATE USING (
    auth.uid() = sofor_id 
    AND OLD.sofor_id IS NOT NULL  -- Sadece atanmış görevlerde
  );

CREATE POLICY "Şoförler kendi GPS verilerini görebilir" ON public.gps_kayitlari
  FOR SELECT USING (auth.uid() = sofor_id);

CREATE POLICY "Şoförler GPS verisi ekleyebilir" ON public.gps_kayitlari
  FOR INSERT WITH CHECK (auth.uid() = sofor_id);

CREATE POLICY "Şoförler kendi profillerini yönetebilir" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Kargomarketing API policies
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
    AND durum = 'eslesme_bekleniyor'
  );

-- Admin policies (log tablosu için)
CREATE POLICY "Admin log erişimi" ON public.admin_logs
  FOR ALL USING (
    current_setting('app.user_role', true) = 'admin'
  );

-- =============================================================================
-- PERFORMANS İNDEKSLERİ
-- =============================================================================

-- Görevler tablosu indexleri
CREATE INDEX IF NOT EXISTS idx_gorevler_tc_kimlik ON public.gorevler(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor_id ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(durum);
CREATE INDEX IF NOT EXISTS idx_gorevler_created_at ON public.gorevler(created_at);

-- Profiles tablosu indexleri
CREATE INDEX IF NOT EXISTS idx_profiles_tc_kimlik ON public.profiles(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON public.profiles(aktif);
CREATE INDEX IF NOT EXISTS idx_profiles_tam_ad ON public.profiles(tam_ad);

-- Tekillik: sadece NULL olmayan tc_kimlik değerlerinde uygula
DROP INDEX IF EXISTS profiles_tc_kimlik_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tc_kimlik_unique_not_null
  ON public.profiles (tc_kimlik)
  WHERE tc_kimlik IS NOT NULL;

-- GPS kayıtları indexleri
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_gorev_id ON public.gps_kayitlari(gorev_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_sofor_id ON public.gps_kayitlari(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_timestamp ON public.gps_kayitlari(timestamp);

-- Admin log indexleri
CREATE INDEX IF NOT EXISTS idx_admin_logs_type ON public.admin_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_resolved ON public.admin_logs(resolved);

-- =============================================================================
-- FUNCTIONS VE TRIGGERS
-- =============================================================================

-- Function: Yeni kullanıcı için otomatik profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Not: tc_kimlik başlangıçta NULL bırakılır; gerçek TC daha sonra güncellenir.
  INSERT INTO public.profiles (id, ad, soyad, aktif)
  VALUES (NEW.id, 'Yeni', 'Şoför', false);
  -- Yeni şoförler başlangıçta pasif, admin onayı sonrası aktif
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: TC Kimlik ile şoför eşleştirme
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
  -- Aktif şoför sayısını kontrol et
  SELECT COUNT(*), id, tam_ad 
  INTO profile_count, matched_sofor_id, current_name
  FROM public.profiles 
  WHERE tc_kimlik = tc_kimlik_param 
    AND aktif = TRUE
  GROUP BY id, tam_ad;
  
  -- Tek eşleşme varsa
  IF profile_count = 1 THEN
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
            json_build_object('count', profile_count, 'message', 'Birden fazla şoför bulundu'));
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Otomatik görev atama
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  matched_driver_id UUID;
BEGIN
  -- TC kimlik kontrolü
  IF LENGTH(NEW.tc_kimlik) != 11 OR NEW.tc_kimlik ~ '[^0-9]' THEN
    NEW.durum := 'gecersiz_tc';
    RETURN NEW;
  END IF;
  
  -- Şoför eşleştirme
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

CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();

-- Function: Kargomarketing API kimlik doğrulama
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

-- Function: GPS tracking güncelleme
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Görevler tablosundaki son konum bilgisini güncelle
  UPDATE public.gorevler 
  SET son_konum_lat = NEW.latitude,
      son_konum_lng = NEW.longitude,
      updated_at = NOW()
  WHERE id = NEW.gorev_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_gps_update
  AFTER INSERT ON public.gps_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- Function: Real-time bildirimler
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Real-time subscription için bildirim gönder
  PERFORM pg_notify('task_status_changed', 
    json_build_object(
      'event_type', 'task_update',
      'gorev_id', NEW.id,
      'ilan_no', NEW.ilan_no,
      'durum', NEW.durum,
      'sofor_id', NEW.sofor_id,
      'kabul_edildi', NEW.kabul_edildi_mi,
      'tc_kimlik', NEW.tc_kimlik,
      'son_konum', json_build_object(
        'lat', NEW.son_konum_lat,
        'lng', NEW.son_konum_lng
      ),
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

-- =============================================================================
-- ADMIN VİEWS (Opsiyonel - Admin dashboard için)
-- =============================================================================

-- Görev özet view
CREATE OR REPLACE VIEW public.gorevler_ozet AS
SELECT 
  g.id,
  g.ilan_no,
  g.durum,
  g.sofor_adi,
  p.tam_ad as sistem_sofor_adi,
  g.tc_kimlik,
  g.kabul_edildi_mi,
  g.musteri_bilgisi,
  g.teslimat_adresi,
  g.created_at,
  CASE 
    WHEN g.son_konum_lat IS NOT NULL 
    THEN json_build_object('lat', g.son_konum_lat, 'lng', g.son_konum_lng)
    ELSE NULL 
  END as son_konum
FROM public.gorevler g
LEFT JOIN public.profiles p ON g.sofor_id = p.id
ORDER BY g.created_at DESC;

-- Çözülmemiş log view
CREATE OR REPLACE VIEW public.cozulmemis_loglar AS
SELECT 
  id,
  log_type,
  ilan_no,
  tc_kimlik,
  sofor_adi,
  error_details,
  created_at
FROM public.admin_logs 
WHERE resolved = FALSE
ORDER BY created_at DESC;

-- =============================================================================
-- BAŞLANGIÇ VERİLERİ (Opsiyonel test için)
-- =============================================================================

-- Test admin kullanıcısı için örnek function
CREATE OR REPLACE FUNCTION public.create_test_admin()
RETURNS VOID AS $$
BEGIN
  -- Bu function sadece development ortamında kullanılmalı
  INSERT INTO public.admin_logs (log_type, error_details)
  VALUES ('system_init', json_build_object('message', 'GPS Master Database initialized'))
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Son olarak sistem başlatma
SELECT public.create_test_admin();

-- =============================================================================
-- SCHEMA VERSİYON BİLGİSİ
-- =============================================================================

COMMENT ON SCHEMA public IS 'GPS Master Database v2.0 - Production Ready Schema';
COMMENT ON TABLE public.gorevler IS 'Ortak görevler tablosu - Kargomarketing yazıyor, GPS koordine ediyor';
COMMENT ON TABLE public.gps_kayitlari IS 'GPS tracking verileri - Sadece GPS Backend';
COMMENT ON TABLE public.profiles IS 'Şoför profilleri - Sadece GPS Backend';
COMMENT ON TABLE public.admin_logs IS 'Admin ve hata logları';
