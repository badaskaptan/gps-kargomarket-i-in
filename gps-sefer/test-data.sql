-- Test verisi eklemek için (Supabase SQL Editor'da çalıştırın)

-- 1. Test kullanıcısı oluşturun (Supabase Auth'da)
-- Email: test@test.com  
-- Şifre: test123

-- 2. Kullanıcı UUID'sini alın:
SELECT id, email FROM auth.users WHERE email = 'test@test.com';

-- 3. UUID'yi kopyalayıp aşağıdaki 'KULLANICI_UUID_BURAYA' yerlerine yapıştırın:

INSERT INTO public.gorevler (
  ilan_no,
  sofor_id,
  sefer_durumu,
  varis_konum,
  konum_verisi
) VALUES 
(
  'NT001',
  'KULLANICI_UUID_BURAYA', -- UUID'yi buraya yapıştırın
  'beklemede',
  ST_SetSRID(ST_MakePoint(29.0, 41.0), 4326)::geography, -- İstanbul Taksim
  '[]'::jsonb
),
(
  'TS002', 
  'KULLANICI_UUID_BURAYA', -- Aynı UUID'yi buraya da yapıştırın
  'beklemede',
  ST_SetSRID(ST_MakePoint(29.1, 41.1), 4326)::geography, -- Yakın test konumu
  '[]'::jsonb
),
(
  'KR003',
  'KULLANICI_UUID_BURAYA', -- Aynı UUID
  'aktif',
  ST_SetSRID(ST_MakePoint(28.9, 40.9), 4326)::geography, -- Başka test konumu
  '[{"lat":41.008,"lon":28.978,"ts":"2025-08-11T10:00:00Z"}]'::jsonb
);

-- Test: Görevleri kontrol edin
SELECT ilan_no, sefer_durumu, sofor_id FROM public.gorevler;
