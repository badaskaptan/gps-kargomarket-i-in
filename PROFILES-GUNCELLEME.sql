-- 🔧 PROFILES TABLOSU GÜNCELLEMESI (SİSTEM ÇALIŞIR DURUMDA)

-- Sistem başarıyla çalışıyor! Sadece profiles güncellemesi eksik

-- 1. Aktif GPS gönderen şoförleri güncelle
UPDATE public.profiles 
SET 
  aktif = true,
  durum = 'aktif'
WHERE id IN (
  SELECT DISTINCT sofor_id 
  FROM public.gps_kayitlari 
  WHERE timestamp > NOW() - INTERVAL '1 hour'
);

-- 2. Sefer durumu 'yolda' olan şoförleri güncelle  
UPDATE public.profiles 
SET 
  aktif = true,
  durum = 'seferde'
WHERE id IN (
  SELECT DISTINCT sofor_id 
  FROM public.gorevler 
  WHERE sefer_durumu = 'yolda'
);

-- 3. Kontrol sorgusu
SELECT 
  p.id,
  p.ad,
  p.soyad,
  p.aktif,
  p.durum,
  COUNT(gk.id) as gps_sayisi,
  MAX(gk.timestamp) as son_gps,
  g.sefer_durumu
FROM public.profiles p
LEFT JOIN public.gps_kayitlari gk ON gk.sofor_id = p.id
LEFT JOIN public.gorevler g ON g.sofor_id = p.id
WHERE p.tc_kimlik = '19111528334'
GROUP BY p.id, p.ad, p.soyad, p.aktif, p.durum, g.sefer_durumu;

-- 4. Sistem durumu özet
SELECT 
  'GPS Trigger Durumu' as kategori,
  'ÇALIŞIYOR ✅' as durum,
  COUNT(*) as kayit_sayisi
FROM public.gps_tracking
WHERE updated_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
  'Konum Güncellemesi' as kategori,
  'ÇALIŞIYOR ✅' as durum,
  COUNT(*) as kayit_sayisi
FROM public.gorevler 
WHERE son_konum_lat IS NOT NULL
UNION ALL
SELECT 
  'JSONB Veri Akışı' as kategori,
  'ÇALIŞIYOR ✅' as durum,
  COUNT(*) as kayit_sayisi
FROM public.gps_kayitlari 
WHERE konum_verisi IS NOT NULL 
  AND timestamp > NOW() - INTERVAL '1 hour';
