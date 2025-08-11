-- Backend entegrasyonu için SQL güncellemeleri

-- 1. Sefer durumlarını güncelle
ALTER TYPE sefer_durumu ADD VALUE IF NOT EXISTS 'atanmamis';
ALTER TYPE sefer_durumu ADD VALUE IF NOT EXISTS 'iptal';

-- 2. Görevler tablosuna yeni alanlar ekle
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cargo_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS cargo_owner JSONB,
ADD COLUMN IF NOT EXISTS loading_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS driver_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_info JSONB,
ADD COLUMN IF NOT EXISTS delivery_address JSONB,
ADD COLUMN IF NOT EXISTS driver_notes TEXT;

-- 2.1 sofor_id'nin NOT NULL constraint'ini kaldır (atanmamış durumlar için)
ALTER TABLE public.gorevler ALTER COLUMN sofor_id DROP NOT NULL;

-- 3. ilan_no için unique constraint ekle (varsa hata vermez)
DO $$ BEGIN
  ALTER TABLE public.gorevler ADD CONSTRAINT unique_ilan_no UNIQUE (ilan_no);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Önce varsa sil, sonra test verisini ekle
DELETE FROM public.gorevler WHERE ilan_no = 'API_TEST_001';

INSERT INTO public.gorevler (
  ilan_no, 
  sofor_id, 
  sefer_durumu, 
  priority,
  cargo_type,
  cargo_owner,
  loading_date,
  deadline,
  customer_info,
  delivery_address,
  varis_konum
) VALUES (
  'API_TEST_001',
  null, -- henüz atanmamış
  'atanmamis',
  'urgent',
  'document',
  '{"name": "ABC Kargo Ltd.", "phone": "+90 212 555 0123", "contact_person": "Mehmet Demir"}',
  '2025-08-12 09:00:00+00',
  '2025-08-12 17:00:00+00',
  '{"name": "Fatma Özkan", "phone": "+90 555 987 6543", "email": "fatma@example.com"}',
  '{"address": "Bağdat Cad. No:456 Kadıköy/İstanbul", "district": "Kadıköy", "city": "İstanbul", "postal_code": "34710"}',
  ST_SetSRID(ST_MakePoint(29.0275, 40.9833), 4326)::geography
);
