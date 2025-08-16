-- 🔧 Trigger Kolonu Senkronizasyon Düzeltmesi
-- Sorun: Trigger'lar 'durum' kolonunu güncelliyor, mobil app 'sefer_durumu' kolonunu okuyor
-- Çözüm: Her iki kolonu da senkron tutacak şekilde trigger'ları güncelle

-- 1. Önce mevcut trigger'ı kaldır
DROP TRIGGER IF EXISTS on_new_task_assign ON public.gorevler;

-- 2. Güncellenmiş trigger fonksiyonunu oluştur
CREATE OR REPLACE FUNCTION public.auto_assign_driver()
RETURNS TRIGGER AS $$
DECLARE
  matched_driver_id UUID;
BEGIN
  -- TC kimlik kontrolü
  IF LENGTH(NEW.tc_kimlik) != 11 OR NEW.tc_kimlik ~ '[^0-9]' THEN
    NEW.durum := 'gecersiz_tc';
    NEW.sefer_durumu := 'gecersiz_tc';  -- ✅ Her iki kolonu da güncelle
    RETURN NEW;
  END IF;
  
  -- Şoför eşleştirme
  matched_driver_id := public.match_driver_by_tc(NEW.tc_kimlik, NEW.sofor_adi);
  
  IF matched_driver_id IS NOT NULL THEN
    NEW.sofor_id := matched_driver_id;
    NEW.durum := 'atandi';
    NEW.sefer_durumu := 'atandi';      -- ✅ Her iki kolonu da güncelle
  ELSE
    NEW.durum := 'sofor_bulunamadi';
    NEW.sefer_durumu := 'beklemede';   -- ✅ Mobil app için beklemede durumuna çevir
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger'ı yeniden oluştur
CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();

-- 4. Mevcut verileri düzelt (şoför bulunamadı olanları beklemede yap)
UPDATE public.gorevler 
SET sefer_durumu = 'beklemede' 
WHERE durum = 'sofor_bulunamadi' AND sefer_durumu IS NULL;

-- 5. Atanmış olanları senkronize et
UPDATE public.gorevler 
SET sefer_durumu = 'atandi' 
WHERE durum = 'atandi' AND sofor_id IS NOT NULL AND sefer_durumu IS NULL;

-- 6. Kontrol sorgusu (çalıştırdıktan sonra bu sorguyu çalıştırarak kontrol edin)
-- SELECT 
--   ilan_no, 
--   tc_kimlik, 
--   durum, 
--   sefer_durumu, 
--   sofor_id,
--   CASE 
--     WHEN durum = 'sofor_bulunamadi' AND sefer_durumu = 'beklemede' THEN '✅ Düzeltildi'
--     WHEN durum = 'atandi' AND sefer_durumu = 'atandi' THEN '✅ Senkron'
--     ELSE '❌ Hala sorunlu'
--   END as durum_kontrolu
-- FROM public.gorevler 
-- ORDER BY created_at DESC;
