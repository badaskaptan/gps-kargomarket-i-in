-- JSONB formatına uygun versiyon
INSERT INTO gorevler (ilan_no, customer_info, delivery_address, sefer_durumu) 
VALUES (
    'NT250801210715',
    '{"company": "gezerholding", "contact": "emrahbadas1980", "phone": "05412879705"}'::jsonb,
    'MERSIN',
    'beklemede'
)
ON CONFLICT (ilan_no) DO UPDATE SET
    customer_info = EXCLUDED.customer_info,
    delivery_address = EXCLUDED.delivery_address,
    updated_at = NOW();

-- Kontrol
SELECT ilan_no, customer_info, delivery_address, sefer_durumu 
FROM gorevler WHERE ilan_no = 'NT250801210715';
