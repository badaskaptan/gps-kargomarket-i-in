-- 🚀 GPS TRIGGER BASIT DÜZELTMESİ

-- 1. Mevcut trigger'ı tamamen kaldır
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari CASCADE;

-- 2. Trigger fonksiyonunu basit hale getir
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Debug log
    RAISE NOTICE 'GPS Trigger çalıştı: Görev %, Konum (%, %)', 
        NEW.gorev_id, NEW.latitude, NEW.longitude;
    
    -- 1. Gorevler tablosunu güncelle
    UPDATE public.gorevler 
    SET son_konum_lat = NEW.latitude,
        son_konum_lng = NEW.longitude,
        updated_at = NOW()
    WHERE id = NEW.gorev_id;
    
    -- 2. GPS tracking'e ekle/güncelle
    INSERT INTO public.gps_tracking (
        gorev_id, latitude, longitude, hiz, yon, dogruluk, created_at, updated_at
    ) VALUES (
        NEW.gorev_id,
        NEW.latitude,
        NEW.longitude,
        COALESCE(NEW.hiz, 0)::INTEGER,
        COALESCE(NEW.yon, 0),
        COALESCE(NEW.dogruluk, 0)::INTEGER,
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger'ı yeniden oluştur
CREATE TRIGGER on_gps_update
    AFTER INSERT ON public.gps_kayitlari
    FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- 4. Test: Manuel GPS kaydı ekle
DO $$
DECLARE
    test_gorev_id UUID;
    test_sofor_id UUID;
BEGIN
    -- Mevcut bir görev ve şoför al
    SELECT g.id, g.sofor_id INTO test_gorev_id, test_sofor_id
    FROM public.gorevler g 
    WHERE g.sofor_id IS NOT NULL 
    LIMIT 1;
    
    IF test_gorev_id IS NOT NULL THEN
        -- Test GPS kaydı ekle
        INSERT INTO public.gps_kayitlari (
            gorev_id, sofor_id, latitude, longitude, hiz, yon, dogruluk
        ) VALUES (
            test_gorev_id,
            test_sofor_id,
            40.217 + random() * 0.001, -- Test koordinatı
            28.945 + random() * 0.001,
            60,
            180,
            5
        );
        
        RAISE NOTICE 'Test GPS kaydı eklendi: Görev %', test_gorev_id;
    END IF;
END $$;

-- 5. Sonuç kontrolü
SELECT 
    'GPS Tracking' as tablo,
    COUNT(*) as kayit_sayisi
FROM public.gps_tracking
UNION ALL
SELECT 
    'Gorevler (Konum Dolu)' as tablo,
    COUNT(*) as kayit_sayisi
FROM public.gorevler 
WHERE son_konum_lat IS NOT NULL;
