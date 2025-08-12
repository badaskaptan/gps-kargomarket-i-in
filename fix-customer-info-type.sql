-- VERİTABANI ŞEMASINI DÜZELTMESİ
-- customer_info ve delivery_address alanlarını TEXT'e çevir

ALTER TABLE gorevler ALTER COLUMN customer_info TYPE TEXT;
ALTER TABLE gorevler ALTER COLUMN delivery_address TYPE TEXT;

-- SONRA: NT250801210715 kaydını ekle
INSERT INTO gorevler (ilan_no, customer_info, delivery_address, sefer_durumu) 
VALUES (
    'NT250801210715',
    'emrahbadas1980 - gezerholding - 05412879705',
    'MERSIN',
    'beklemede'
)
ON CONFLICT (ilan_no) DO UPDATE SET
    customer_info = EXCLUDED.customer_info,
    delivery_address = EXCLUDED.delivery_address,
    updated_at = NOW();

-- Kontrol
SELECT * FROM gorevler WHERE ilan_no = 'NT250801210715';
