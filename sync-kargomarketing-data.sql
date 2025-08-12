-- Kargomarketing.com verilerinden GPS sistemine transfer
-- NT250801210715 ilan numarası için

INSERT INTO gorevler (
    ilan_no,
    customer_info,
    delivery_address,
    sefer_durumu,
    created_at
) VALUES (
    'NT250801210715',
    '{"name": "emrahbadas1980", "email": "emrahbadas1980@gmail.com", "phone": "05412879705", "company": "gezerholding"}'::jsonb,
    'MERSIN',
    'beklemede',
    '2025-08-12 01:18:43.05466+00'
)
ON CONFLICT (ilan_no) DO UPDATE SET
    customer_info = EXCLUDED.customer_info,
    delivery_address = EXCLUDED.delivery_address,
    updated_at = NOW();

-- Verification
SELECT * FROM gorevler WHERE ilan_no = 'NT250801210715';
