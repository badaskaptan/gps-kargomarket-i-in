-- TÜM ALANLAR JSON FORMATINDA
-- Her alan için doğru JSON syntax kullanılıyor

INSERT INTO gorevler (ilan_no, customer_info, delivery_address, sefer_durumu) 
VALUES (
    'NT250801210715',
    '{"name": "emrahbadas1980", "email": "emrahbadas1980@gmail.com", "phone": "05412879705", "company": "gezerholding"}'::jsonb,
    '{"address": "MERSIN", "coordinates": null}'::jsonb,
    'beklemede'
)
ON CONFLICT (ilan_no) DO UPDATE SET
    customer_info = EXCLUDED.customer_info,
    delivery_address = EXCLUDED.delivery_address,
    updated_at = NOW();

-- Kontrol
SELECT 
    ilan_no, 
    customer_info,
    delivery_address,
    sefer_durumu,
    created_at
FROM gorevler 
WHERE ilan_no = 'NT250801210715';
