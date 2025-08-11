-- 🔐 GPS Backend RLS Policy Fix
-- Supabase Dashboard > SQL Editor'da çalıştır

-- 1. Mevcut policies'leri kontrol et
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('gorevler', 'gps_verileri', 'kullanicilar');

-- 2. Gorevler tablosu için policies
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON gorevler;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON gorevler;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON gorevler;

-- 3. Yeni policies - daha esnek
CREATE POLICY "Allow all operations for authenticated users" ON gorevler
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- 4. GPS verileri tablosu policies
DROP POLICY IF EXISTS "Authenticated users can manage GPS data" ON gps_verileri;

CREATE POLICY "Allow all GPS operations for authenticated users" ON gps_verileri
  FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- 5. Kullanıcılar tablosu policies (eğer varsa)
DROP POLICY IF EXISTS "Users can view own profile" ON kullanicilar;

-- 6. Anonymous kullanıcı için geçici policy (test için)
CREATE POLICY "Allow anonymous read tasks" ON gorevler
  FOR SELECT 
  TO anon
  USING (true);

-- 7. RLS durumunu kontrol et
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  forcerowsecurity
FROM pg_tables 
WHERE tablename IN ('gorevler', 'gps_verileri')
  AND schemaname = 'public';

-- 8. Test: Gorevler tablosunu anonymous olarak sorgula
SET ROLE anon;
SELECT count(*) as toplam_gorev FROM gorevler;
RESET ROLE;

-- ✅ Policies listesini göster
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'gorevler';
