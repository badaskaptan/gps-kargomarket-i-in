-- 🔐 GPS Backend Test Kullanıcısı
-- Supabase Dashboard > SQL Editor'da çalıştır

-- 1. Test şoförü oluştur
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  phone_change,
  phone_change_token,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_change_sent_at,
  confirmed_at,
  email_change_sent_at,
  recovery_sent_at,
  invited_at,
  action_link,
  email_change_token,
  is_sso_user,
  deleted_at,
  is_anonymous,
  raw_app_meta_data,
  raw_user_meta_data,
  last_sign_in_at
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'sofor@test.com',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  0,
  null,
  '',
  null,
  false,
  now(),
  now(),
  '+905551234567',
  null,
  now(),
  null,
  null,
  null,
  '',
  '',
  false,
  null,
  false,
  '{"provider": "email", "providers": ["email"]}',
  '{"ad": "Test", "soyad": "Şoför", "telefon": "+905551234567"}',
  now()
);

-- 2. Test kullanıcı bilgilerini göster
SELECT 
  email,
  phone,
  created_at,
  email_confirmed_at
FROM auth.users 
WHERE email = 'sofor@test.com';

-- 3. Identity bilgisi de ekle
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) 
SELECT 
  gen_random_uuid(),
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'phone', phone,
    'email_verified', true,
    'phone_verified', true
  ),
  'email',
  now(),
  now(),
  now()
FROM auth.users 
WHERE email = 'sofor@test.com';

-- 4. Görev tablosunda test verisi oluştur
INSERT INTO gorevler (
  ilan_no,
  musteri_adi,
  musteri_telefon,
  baslangic_adresi,
  bitis_adresi,
  sefer_durumu,
  oncelik,
  oluşturulma_tarihi
) VALUES (
  'KRG2025001',
  'Test Müşteri A.Ş.',
  '+905551112233',
  'Ankara Kızılay',
  'İstanbul Taksim',
  'atanmamis',
  'yuksek',
  now()
);

-- 5. Başka test görevleri
INSERT INTO gorevler (
  ilan_no,
  musteri_adi,
  musteri_telefon,
  baslangic_adresi,
  bitis_adresi,
  sefer_durumu,
  oncelik,
  oluşturulma_tarihi
) VALUES 
(
  'KRG2025002',
  'ABC Kargo Ltd.',
  '+905552223344',
  'İzmir Alsancak',
  'Bursa Osmangazi',
  'atanmamis',
  'normal',
  now()
),
(
  'KRG2025003',
  'XYZ Lojistik',
  '+905553334455',
  'Antalya Merkez',
  'Adana Seyhan',
  'atanmamis',
  'dusuk',
  now()
);

-- ✅ Test verilerini kontrol et
SELECT 
  ilan_no,
  musteri_adi,
  sefer_durumu,
  oncelik,
  oluşturulma_tarihi
FROM gorevler 
ORDER BY oluşturulma_tarihi DESC
LIMIT 5;
