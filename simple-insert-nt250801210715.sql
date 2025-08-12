-- Basit versiyon - NT250801210715 ilan kaydı
-- Sadece gerekli alanlar

INSERT INTO gorevler (ilan_no, customer_info, delivery_address, sefer_durumu) 
VALUES (
    'NT250801210715',
    'emrahbadas1980 - gezerholding - 05412879705',
    'MERSIN',
    'beklemede'
);

-- Kontrol
SELECT * FROM gorevler WHERE ilan_no = 'NT250801210715';
