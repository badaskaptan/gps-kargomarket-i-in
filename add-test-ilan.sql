-- NT250801210715 ilan numarası için test kaydı oluştur
INSERT INTO gorevler (
    ilan_no,
    customer_info,
    delivery_address,
    sefer_durumu,
    created_at
) VALUES (
    'NT250801210715',
    'Test Müşteri - Nakliye Takip Sistemi',
    'İstanbul Beylikdüzü Test Mahallesi, Test Sokak No:1',
    'beklemede',
    NOW()
);

-- Verification query
SELECT * FROM gorevler WHERE ilan_no = 'NT250801210715';
