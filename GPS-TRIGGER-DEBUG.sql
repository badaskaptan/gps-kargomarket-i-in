-- 🔧 GPS TRIGGER TEST VE DÜZELTMESİ
-- Sorun: gps_kayitlari dolu ama trigger çalışmıyor

-- 1. Mevcut trigger'ları kontrol et
SELECT 
  schemaname,
  tablename, 
  triggername,
  procname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public' 
  AND c.relname IN ('gps_kayitlari', 'gorevler');

-- 2. Trigger fonksiyonunu kontrol et
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_gps_tracking';

-- 3. Test: Manuel trigger çalıştırma (en son GPS kaydı için)
WITH latest_gps AS (
  SELECT * FROM gps_kayitlari 
  ORDER BY timestamp DESC 
  LIMIT 1
)
SELECT 
  gk.id,
  gk.gorev_id,
  gk.latitude,
  gk.longitude,
  g.son_konum_lat,
  g.son_konum_lng,
  gt.latitude as tracking_lat,
  gt.longitude as tracking_lng
FROM latest_gps gk
LEFT JOIN gorevler g ON g.id = gk.gorev_id
LEFT JOIN gps_tracking gt ON gt.gorev_id = gk.gorev_id;

-- 4. Profiles tablosu düzeltmesi
UPDATE profiles 
SET aktif = true, 
    durum = 'aktif'
WHERE id IN (
  SELECT DISTINCT sofor_id 
  FROM gps_kayitlari 
  WHERE timestamp > NOW() - INTERVAL '1 hour'
);

-- 5. Manual trigger tetikleme (test amaçlı)
DO $$
DECLARE
    gps_record RECORD;
BEGIN
    -- En son GPS kaydını al
    SELECT * INTO gps_record 
    FROM gps_kayitlari 
    ORDER BY timestamp DESC 
    LIMIT 1;
    
    IF gps_record IS NOT NULL THEN
        -- Manuel olarak trigger fonksiyonunu çağır
        PERFORM update_gps_tracking();
        
        -- Sonuçları kontrol et
        RAISE NOTICE 'Manuel trigger tetiklendi: Görev ID = %', gps_record.gorev_id;
    END IF;
END $$;

-- 6. Trigger yeniden oluştur (güvenlik için)
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari;

CREATE TRIGGER on_gps_update
  AFTER INSERT ON public.gps_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- 7. Kontrol sorgusu
SELECT 
  'gps_kayitlari' as tablo,
  COUNT(*) as kayit_sayisi
FROM gps_kayitlari
UNION ALL
SELECT 
  'gps_tracking' as tablo,
  COUNT(*) as kayit_sayisi  
FROM gps_tracking
UNION ALL
SELECT 
  'gorevler (son_konum dolu)' as tablo,
  COUNT(*) as kayit_sayisi
FROM gorevler 
WHERE son_konum_lat IS NOT NULL;
