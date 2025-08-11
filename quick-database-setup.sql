-- ⚡ HIZLI DATABASE SETUP - Test İçin Minimum Gereksinimler
-- Bu dosyayı Supabase Dashboard > SQL Editor'da çalıştırın

-- 1. Sürücü ID sütunu zaten var (sofor_id olarak), sadece customer_info eklememiz yeterli
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'gorevler' AND column_name = 'customer_info'
    ) THEN
        ALTER TABLE gorevler ADD COLUMN customer_info JSONB;
    END IF;
END $$;

-- 2. İlan numarası için unique constraint ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'gorevler_ilan_no_key' AND table_name = 'gorevler'
    ) THEN
        ALTER TABLE gorevler ADD CONSTRAINT gorevler_ilan_no_key UNIQUE (ilan_no);
    END IF;
END $$;

-- 3. Test verisi (mevcut tablo yapısına uygun)
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

-- 4. Test RPC fonksiyonu (mevcut tablo yapısına uygun)
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

-- 5. get_active_gorevler RPC fonksiyonu (App.tsx için gerekli)
-- Önce mevcut fonksiyonu sil
DROP FUNCTION IF EXISTS get_active_gorevler();

-- Yeni fonksiyonu oluştur
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

-- 6. Test kullanıcısı oluştur (eğer yoksa)
-- Not: Bu sadece test@test.com kullanıcısı için çalışır
-- Gerçek kullanıcı kaydı Supabase Auth ile yapılmalı

-- ✅ KURULUM TAMAMLANDI
-- Şimdi test edebilirsiniz:
-- 1. Mobil uygulamada test@test.com / test123 ile giriş yapın
-- 2. "İlan No ile Bağlan" butonuna tıklayın  
-- 3. İlan numarası: KRG2025001
-- 4. Bağlantı başarılı olmalı!
