-- Görevler tablosuna sofor_id otomatik atama trigger'ı
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Trigger fonksiyonu oluştur
CREATE OR REPLACE FUNCTION match_driver_by_tc_and_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer sofor_id zaten atanmışsa, güncelleme yapma
  IF NEW.sofor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- TC kimlik ile eşleşen profile sahip kullanıcıyı bul
  IF NEW.tc_kimlik IS NOT NULL THEN
    SELECT id INTO NEW.sofor_id
    FROM profiles
    WHERE tc_kimlik = NEW.tc_kimlik
    LIMIT 1;
  END IF;

  -- Eğer TC kimlik ile bulunamadıysa, ad ile eşleşmeyi dene
  IF NEW.sofor_id IS NULL AND NEW.ad IS NOT NULL THEN
    SELECT id INTO NEW.sofor_id
    FROM profiles
    WHERE LOWER(ad) = LOWER(NEW.ad)
    LIMIT 1;
  END IF;

  -- Eğer sofor_id atandıysa, durumu güncelle
  IF NEW.sofor_id IS NOT NULL AND NEW.sefer_durumu IS NULL THEN
    NEW.sefer_durumu := 'atanmis';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger'ı oluştur (INSERT ve UPDATE için)
DROP TRIGGER IF EXISTS auto_assign_driver ON gorevler;
CREATE TRIGGER auto_assign_driver
  BEFORE INSERT OR UPDATE ON gorevler
  FOR EACH ROW
  EXECUTE FUNCTION match_driver_by_tc_and_name();

-- 3. Mevcut görevleri güncelle (sofor_id null olanlar için)
UPDATE gorevler 
SET sofor_id = profiles.id, sefer_durumu = 'atanmis'
FROM profiles 
WHERE gorevler.sofor_id IS NULL 
  AND (
    gorevler.tc_kimlik = profiles.tc_kimlik 
    OR LOWER(gorevler.ad) = LOWER(profiles.ad)
  );

-- 4. Sonuçları kontrol et
SELECT 
  ilan_no,
  tc_kimlik,
  ad,
  sofor_id,
  sefer_durumu,
  CASE 
    WHEN sofor_id IS NOT NULL THEN 'Atandı'
    ELSE 'Atanmamış'
  END as durum
FROM gorevler 
ORDER BY created_at DESC 
LIMIT 10;
