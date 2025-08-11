-- 🚀 KARGOMARKETING.COM SUPABASE İÇİN TAM SETUP
-- Bu dosyayı kargomarketing.com Supabase Dashboard > SQL Editor'da çalıştırın

-- 1) Gerekli eklentiler (eğer yoksa)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2) Sefer durumu enum'u (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sefer_durumu') THEN
    CREATE TYPE sefer_durumu AS ENUM ('atanmamis','beklemede','aktif','tamamlandı','iptal');
  END IF;
END $$;

-- 3) Görevler tablosu oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS public.gorevler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ilan_no TEXT NOT NULL UNIQUE,
  sofor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sefer_durumu sefer_durumu NOT NULL DEFAULT 'atanmamis',
  konum_verisi JSONB NOT NULL DEFAULT '[]'::jsonb,
  varis_konum GEOGRAPHY(Point,4326),
  baslama_zamani TIMESTAMPTZ,
  bitis_zamani TIMESTAMPTZ,
  customer_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Tamamlandı'dan geri dönüşü engelle
  CONSTRAINT sefer_durumu_final_immutable CHECK (
    NOT (sefer_durumu <> 'tamamlandı' AND bitis_zamani IS NOT NULL)
  )
);

-- 4) İndeksler (eğer yoksa)
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(sefer_durumu);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_gorevler_varis_gix ON public.gorevler USING GIST (varis_konum);

-- 5) updated_at tetikleyici (eğer yoksa)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gorevler_updated_at ON public.gorevler;
CREATE TRIGGER trg_gorevler_updated_at
  BEFORE UPDATE ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) RLS (Row Level Security) politikaları
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;

-- Mevcut politikaları sil
DROP POLICY IF EXISTS "Users can view own tasks" ON public.gorevler;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.gorevler;
DROP POLICY IF EXISTS "System can insert tasks" ON public.gorevler;

-- Kullanıcılar sadece kendi görevlerini görebilir
CREATE POLICY "Users can view own tasks" ON public.gorevler
  FOR SELECT USING (sofor_id = auth.uid());

-- Kullanıcılar kendi görevlerini güncelleyebilir
CREATE POLICY "Users can update own tasks" ON public.gorevler
  FOR UPDATE USING (sofor_id = auth.uid());

-- Sistem görev oluşturabilir
CREATE POLICY "System can insert tasks" ON public.gorevler
  FOR INSERT WITH CHECK (true);

-- 7) Test verisi ekle
INSERT INTO gorevler (
  ilan_no, 
  sofor_id,
  sefer_durumu,
  varis_konum,
  customer_info
) VALUES (
  'KRG2025001',
  NULL, -- Henüz şoför atanmamış
  'atanmamis'::sefer_durumu,
  ST_GeogFromText('POINT(29.0100 41.0422)'), -- Beşiktaş koordinatları
  '{"name": "Test Müşteri", "company": "Test Şirketi", "phone": "+90 555 123 4567", "pickup": "Kadıköy, İstanbul", "delivery": "Beşiktaş, İstanbul", "priority": "normal"}'::jsonb
) ON CONFLICT (ilan_no) DO NOTHING;

-- 8) Test RPC fonksiyonu
CREATE OR REPLACE FUNCTION test_connect_driver(
  p_ilan_no TEXT,
  p_driver_id UUID
)
RETURNS JSON AS $$
DECLARE
  task_record RECORD;
  customer_data JSONB;
BEGIN
  -- İlan numarasına göre görevi bul (sefer_durumu = 'atanmamis')
  SELECT * INTO task_record 
  FROM gorevler 
  WHERE ilan_no = p_ilan_no AND sefer_durumu = 'atanmamis';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'İlan numarası bulunamadı veya dolu'
    );
  END IF;
  
  -- Şoförü görevle eşleştir
  UPDATE gorevler 
  SET 
    sofor_id = p_driver_id,
    sefer_durumu = 'beklemede',
    baslama_zamani = NOW()
  WHERE id = task_record.id;
  
  -- Müşteri bilgilerini customer_info'dan al
  customer_data = task_record.customer_info;
  
  -- Başarılı yanıt
  RETURN json_build_object(
    'success', true,
    'task_id', task_record.id,
    'customer_info', customer_data,
    'message', 'Bağlantı başarılı'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', 'Database hatası: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9) get_active_gorevler RPC fonksiyonu
DROP FUNCTION IF EXISTS get_active_gorevler();

CREATE FUNCTION get_active_gorevler()
RETURNS TABLE (
  id UUID,
  ilan_no TEXT,
  sofor_id UUID,
  sefer_durumu sefer_durumu,
  konum_verisi JSONB,
  varis_konum GEOGRAPHY,
  baslama_zamani TIMESTAMPTZ,
  bitis_zamani TIMESTAMPTZ,
  customer_info JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Kullanıcının sadece kendi görevlerini görmesini sağla
  RETURN QUERY
  SELECT g.id, g.ilan_no, g.sofor_id, g.sefer_durumu, g.konum_verisi, 
         g.varis_konum, g.baslama_zamani, g.bitis_zamani, g.customer_info,
         g.created_at, g.updated_at
  FROM gorevler g
  WHERE g.sofor_id = auth.uid() 
    AND g.sefer_durumu IN ('beklemede', 'aktif');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ KURULUM TAMAMLANDI!
-- Şimdi test edebilirsiniz:
-- 1. Mobil uygulamada test@example.com ile giriş yapın (şifre: kargomarketing'den öğrenin)
-- 2. "İlan No ile Bağlan" butonuna tıklayın  
-- 3. İlan numarası: KRG2025001
-- 4. Bağlantı başarılı olmalı!
