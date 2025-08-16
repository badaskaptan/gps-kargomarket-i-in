-- 🚀 ACIL GPS TRIGGER DÜZELTMESİ VE PROFİLES GÜNCELLEMESİ

-- 1. Trigger'ı yeniden oluştur
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari;

CREATE TRIGGER on_gps_update
  AFTER INSERT ON public.gps_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();

-- 2. Profiles tablosunu düzelt (aktif şoförler için)
UPDATE public.profiles 
SET 
  aktif = true,
  durum = 'aktif'
WHERE id IN (
  SELECT DISTINCT sofor_id 
  FROM public.gps_kayitlari 
  WHERE timestamp > NOW() - INTERVAL '1 day'
);

-- 3. Manuel trigger test (mevcut GPS kayıtları için)
DO $$
DECLARE
    gps_record RECORD;
    counter INTEGER := 0;
BEGIN
    -- En son 5 GPS kaydını al ve manuel işle
    FOR gps_record IN 
        SELECT DISTINCT ON (gorev_id) *
        FROM public.gps_kayitlari 
        ORDER BY gorev_id, timestamp DESC
        LIMIT 5
    LOOP
        -- Manuel olarak gorevler tablosunu güncelle
        UPDATE public.gorevler 
        SET son_konum_lat = gps_record.latitude,
            son_konum_lng = gps_record.longitude,
            updated_at = NOW()
        WHERE id = gps_record.gorev_id;
        
        -- Manuel olarak gps_tracking'e ekle
        INSERT INTO public.gps_tracking (
            gorev_id, latitude, longitude, hiz, yon, dogruluk, created_at, updated_at
        ) VALUES (
            gps_record.gorev_id,
            gps_record.latitude,
            gps_record.longitude,
            gps_record.hiz::INTEGER,
            gps_record.yon,
            gps_record.dogruluk::INTEGER,
            gps_record.timestamp,
            gps_record.timestamp
        )
        ON CONFLICT (gorev_id) 
        DO UPDATE SET
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            hiz = EXCLUDED.hiz,
            yon = EXCLUDED.yon,
            dogruluk = EXCLUDED.dogruluk,
            updated_at = EXCLUDED.updated_at;
            
        counter := counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Manuel işlendi: % GPS kaydı', counter;
END $$;

-- 4. Sonuç kontrolü
SELECT 
    'Tablo Durumu' as kategori,
    'gps_kayitlari' as tablo,
    COUNT(*) as kayit_sayisi,
    MAX(timestamp) as son_kayit
FROM public.gps_kayitlari
UNION ALL
SELECT 
    'Tablo Durumu' as kategori,
    'gps_tracking' as tablo,
    COUNT(*) as kayit_sayisi,
    MAX(updated_at) as son_kayit
FROM public.gps_tracking
UNION ALL
SELECT 
    'Tablo Durumu' as kategori,
    'gorevler (konum dolu)' as tablo,
    COUNT(*) as kayit_sayisi,
    MAX(updated_at) as son_kayit
FROM public.gorevler 
WHERE son_konum_lat IS NOT NULL
UNION ALL
SELECT 
    'Profil Durumu' as kategori,
    'profiles (aktif)' as tablo,
    COUNT(*) as kayit_sayisi,
    MAX(created_at) as son_kayit
FROM public.profiles 
WHERE aktif = true;

-- 5. GPS veri akışı test
SELECT 
    g.ilan_no,
    g.son_konum_lat,
    g.son_konum_lng,
    gt.latitude as tracking_lat,
    gt.longitude as tracking_lng,
    COUNT(gk.id) as gps_kayit_sayisi
FROM public.gorevler g
LEFT JOIN public.gps_tracking gt ON gt.gorev_id = g.id
LEFT JOIN public.gps_kayitlari gk ON gk.gorev_id = g.id
WHERE g.sofor_id IS NOT NULL
GROUP BY g.id, g.ilan_no, g.son_konum_lat, g.son_konum_lng, gt.latitude, gt.longitude
ORDER BY g.updated_at DESC;
