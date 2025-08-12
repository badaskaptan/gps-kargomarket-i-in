-- Önce veritabanı şemasını kontrol et
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'gorevler' 
ORDER BY ordinal_position;
