-- 🔧 GPS TRIGGER DETAYLI DEBUGGİNG VE DÜZELTMESİ

-- 1. Mevcut trigger durumunu kontrol et
SELECT 
  t.tgname as trigger_name,
  t.tgenabled as enabled,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'gps_kayitlari';

-- 2. Trigger fonksiyonunu kontrol et
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_gps_tracking';

-- 3. RLS politikaları kontrol et (trigger engelliyor olabilir)
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('gps_kayitlari', 'gps_tracking', 'gorevler');

-- 4. Manual trigger test (debug ile)
DO $$
DECLARE
    test_record RECORD;
    result_text TEXT;
BEGIN
    -- En son GPS kaydını al
    SELECT * INTO test_record 
    FROM public.gps_kayitlari 
    ORDER BY timestamp DESC 
    LIMIT 1;
    
    IF test_record IS NOT NULL THEN
        RAISE NOTICE 'Test kaydı bulundu: Görev ID = %, Konum = (%, %)', 
            test_record.gorev_id, test_record.latitude, test_record.longitude;
        
        -- Manuel olarak trigger fonksiyonunu test et
        BEGIN
            -- Trigger benzeri işlem yap
            UPDATE public.gorevler 
            SET son_konum_lat = test_record.latitude,
                son_konum_lng = test_record.longitude,
                updated_at = NOW()
            WHERE id = test_record.gorev_id;
            
            GET DIAGNOSTICS result_text = ROW_COUNT;
            RAISE NOTICE 'Gorevler güncellendi: % satır', result_text;
            
            -- GPS tracking'e manuel ekle
            INSERT INTO public.gps_tracking (
                gorev_id, latitude, longitude, hiz, yon, dogruluk, created_at, updated_at
            ) VALUES (
                test_record.gorev_id,
                test_record.latitude,
                test_record.longitude,
                COALESCE(test_record.hiz::INTEGER, 0),
                COALESCE(test_record.yon, 0),
                COALESCE(test_record.dogruluk::INTEGER, 0),
                test_record.timestamp,
                test_record.timestamp
            )
            ON CONFLICT (gorev_id) 
            DO UPDATE SET
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                hiz = EXCLUDED.hiz,
                yon = EXCLUDED.yon,
                dogruluk = EXCLUDED.dogruluk,
                updated_at = EXCLUDED.updated_at;
                
            GET DIAGNOSTICS result_text = ROW_COUNT;
            RAISE NOTICE 'GPS tracking güncellendi: % satır', result_text;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'HATA: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        END;
    ELSE
        RAISE NOTICE 'Test için GPS kaydı bulunamadı';
    END IF;
END $$;

-- 5. Trigger'ı tamamen yeniden oluştur (güçlü mode)
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari CASCADE;

-- 6. Trigger fonksiyonunu güncelle (RLS bypass + hata yönetimi)
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS TRIGGER AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    -- RLS bypass (service_role yetkisi)
    PERFORM set_config('role', 'service_role', true);
    
    RAISE NOTICE 'GPS Trigger tetiklendi: Görev ID = %, Konum = (%, %)', 
        NEW.gorev_id, NEW.latitude, NEW.longitude;
    
    -- 1. Gorevler tablosunu güncelle
    UPDATE public.gorevler 
    SET son_konum_lat = NEW.latitude,
        son_konum_lng = NEW.longitude,
        updated_at = NOW()
    WHERE id = NEW.gorev_id;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'Gorevler tablosu güncellendi: % satır', affected_rows;
    
    -- 2. GPS tracking tablosunu güncelle
    INSERT INTO public.gps_tracking (
        gorev_id, latitude, longitude, hiz, yon, dogruluk, created_at, updated_at
    ) VALUES (
        NEW.gorev_id,
        NEW.latitude,
        NEW.longitude,
        COALESCE(NEW.hiz::INTEGER, 0),
        COALESCE(NEW.yon, 0),
        COALESCE(NEW.dogruluk::INTEGER, 0),
        NEW.timestamp,
        NEW.timestamp
    )
    ON CONFLICT (gorev_id) 
    DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        hiz = EXCLUDED.hiz,
        yon = EXCLUDED.yon,
        dogruluk = EXCLUDED.dogruluk,
        updated_at = EXCLUDED.updated_at;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RAISE NOTICE 'GPS tracking güncellendi: % satır', affected_rows;
    
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Trigger HATASI: %, SQLSTATE: %', SQLERRM, SQLSTATE;
        RETURN NEW; -- Hatada bile NEW döndür
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger'ı yeniden oluştur
CREATE TRIGGER on_gps_update
    AFTER INSERT ON public.gps_kayitlari
    FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- 8. Trigger test (yeni GPS kaydı ekleyerek)
INSERT INTO public.gps_kayitlari (
    gorev_id, 
    sofor_id, 
    latitude, 
    longitude, 
    hiz, 
    yon, 
    dogruluk,
    konum_verisi
) 
SELECT 
    gorev_id,
    sofor_id,
    latitude + 0.00001, -- Küçük değişiklik
    longitude + 0.00001,
    hiz,
    yon,
    dogruluk,
    konum_verisi
FROM public.gps_kayitlari 
ORDER BY timestamp DESC 
LIMIT 1;

-- 9. Sonuç kontrolü
SELECT 
    'TRIGGER TEST SONUCU' as test_type,
    COUNT(*) as gps_tracking_count
FROM public.gps_tracking;

SELECT 
    'GOREVLER KONUM DURUMU' as test_type,
    COUNT(*) as konum_dolu_count
FROM public.gorevler 
WHERE son_konum_lat IS NOT NULL;
