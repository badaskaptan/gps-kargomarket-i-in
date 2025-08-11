-- GPS Görevler Tablosu Güncelleme - Driver Bağlantı Sistemi İçin
-- Bu SQL komutlarını Supabase SQL Editor'da çalıştırın

-- 1) Görevler tablosuna driver bilgilerini ekle
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_email TEXT,
ADD COLUMN IF NOT EXISTS customer_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS cargo_type TEXT,
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

-- 2) Sefer durumu enum'unu güncelle (atandi durumu ekle)
DO $$
BEGIN
  -- Önce mevcut enum'u kontrol et
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sefer_durumu') THEN
    -- Yeni enum oluştur
    CREATE TYPE sefer_durumu_new AS ENUM (
      'atanmamis',
      'atandi',        -- YENİ: Şöför atandı ama henüz başlamadı
      'beklemede',
      'aktif', 
      'devam_ediyor',  -- YENİ: Sefer devam ediyor
      'tamamlandı',
      'iptal'
    );
    
    -- Tabloyu güncelle
    ALTER TABLE public.gorevler ALTER COLUMN sefer_durumu TYPE sefer_durumu_new 
    USING sefer_durumu::text::sefer_durumu_new;
    
    -- Eski enum'u sil
    DROP TYPE sefer_durumu;
    
    -- Yeni enum'u eski adla yeniden adlandır
    ALTER TYPE sefer_durumu_new RENAME TO sefer_durumu;
  END IF;
END $$;

-- 3) İlan numarası için unique constraint ekle
CREATE UNIQUE INDEX IF NOT EXISTS idx_gorevler_ilan_no_unique 
ON public.gorevler(ilan_no);

-- 4) Driver bağlantısı için RPC fonksiyon
CREATE OR REPLACE FUNCTION public.connect_driver_to_task(
  p_ilan_no TEXT,
  p_driver_id UUID,
  p_driver_email TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result_task public.gorevler%ROWTYPE;
BEGIN
  -- 1) İlan numarasını kontrol et
  SELECT * INTO result_task FROM public.gorevler WHERE ilan_no = p_ilan_no;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'İlan numarası bulunamadı'
    );
  END IF;
  
  -- 2) Zaten atanmış mı kontrol et
  IF result_task.driver_id IS NOT NULL AND result_task.driver_id != p_driver_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Bu ilan zaten başka bir şöföre atanmış'
    );
  END IF;
  
  -- 3) Şöförü ata
  UPDATE public.gorevler 
  SET 
    driver_id = p_driver_id,
    driver_email = p_driver_email,
    sefer_durumu = 'atandi',
    updated_at = NOW()
  WHERE ilan_no = p_ilan_no
  RETURNING * INTO result_task;
  
  -- 4) Başarılı sonuç
  RETURN json_build_object(
    'success', true,
    'task_id', result_task.id,
    'ilan_no', result_task.ilan_no,
    'status', result_task.sefer_durumu,
    'customer_info', result_task.customer_info,
    'delivery_address', result_task.delivery_address
  );
END $$;

-- 5) RLS politikalarını güncelle
-- Kullanıcılar sadece kendi atandıkları görevleri görebilir
DROP POLICY IF EXISTS "Users can read own tasks" ON public.gorevler;
CREATE POLICY "Users can read own tasks" ON public.gorevler
  FOR SELECT USING (
    auth.uid() = sofor_id OR 
    auth.uid() = driver_id OR
    sefer_durumu = 'atanmamis'  -- Atanmamış görevler herkes görebilir
  );

-- Kullanıcılar sadece kendi görevlerini güncelleyebilir
DROP POLICY IF EXISTS "Users can update own tasks" ON public.gorevler;
CREATE POLICY "Users can update own tasks" ON public.gorevler
  FOR UPDATE USING (
    auth.uid() = sofor_id OR 
    auth.uid() = driver_id
  );

-- 6) get_active_gorevler fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION public.get_active_gorevler()
RETURNS SETOF public.gorevler LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.gorevler
  WHERE 
    (auth.uid() = sofor_id OR auth.uid() = driver_id)
    AND sefer_durumu IN ('atandi', 'beklemede', 'aktif', 'devam_ediyor');
END $$;

-- 7) Şöför onay fonksiyonu güncelle
CREATE OR REPLACE FUNCTION public.start_sefer(g_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.gorevler
  SET 
    sefer_durumu = 'devam_ediyor',
    baslama_zamani = NOW(),
    updated_at = NOW()
  WHERE 
    id = g_id 
    AND (auth.uid() = sofor_id OR auth.uid() = driver_id)
    AND sefer_durumu IN ('atandi', 'beklemede');
END $$;

-- 8) Test verisi - örnek görev
INSERT INTO public.gorevler (
  ilan_no, 
  sofor_id, 
  sefer_durumu,
  customer_info,
  delivery_address,
  priority,
  cargo_type
) VALUES (
  'KRG2025001',
  (SELECT id FROM auth.users LIMIT 1), -- İlk kullanıcıyı al
  'atanmamis',
  '{"name": "ABC Lojistik", "phone": "+90 555 123 4567", "email": "info@abc.com"}',
  '{"city": "İstanbul", "district": "Kadıköy", "full_address": "Test Mahallesi Test Caddesi No:1"}',
  'urgent',
  'electronics'
) ON CONFLICT (ilan_no) DO NOTHING;

-- Başarı mesajı
SELECT 'Driver bağlantı sistemi başarıyla kuruldu! ✅' as result;
