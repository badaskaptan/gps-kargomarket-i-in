-- ⚡ HIZLI DATABASE UPDATE - Sadece gerekli kısımlar
-- Bu kodu Supabase SQL Editor'da çalıştırın

-- 1) Driver kolonlarını ekle
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS driver_email TEXT,
ADD COLUMN IF NOT EXISTS customer_info JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT '{}';

-- 2) Test kullanıcı ve görev oluştur
INSERT INTO public.gorevler (
  ilan_no, 
  sofor_id, 
  sefer_durumu,
  customer_info,
  delivery_address
) VALUES (
  'KRG2025001',
  (SELECT id FROM auth.users WHERE email = 'test@test.com' LIMIT 1),
  'atanmamis',
  '{"name": "Test Müşteri", "phone": "+90 555 123 4567"}',
  '{"city": "İstanbul", "district": "Test Mahallesi"}'
) ON CONFLICT (ilan_no) DO NOTHING;

-- 3) Basit bağlantı fonksiyonu (geçici Edge Function olmadan)
CREATE OR REPLACE FUNCTION public.test_connect_driver(
  p_ilan_no TEXT,
  p_driver_id UUID
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result_task public.gorevler%ROWTYPE;
BEGIN
  -- İlan var mı kontrol et
  SELECT * INTO result_task FROM public.gorevler WHERE ilan_no = p_ilan_no;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'İlan bulunamadı');
  END IF;
  
  -- Şöföre ata
  UPDATE public.gorevler 
  SET driver_id = p_driver_id, sefer_durumu = 'beklemede'
  WHERE ilan_no = p_ilan_no
  RETURNING * INTO result_task;
  
  RETURN json_build_object(
    'success', true, 
    'ilan_no', result_task.ilan_no,
    'customer_info', result_task.customer_info
  );
END $$;

-- Test için RLS politikalarını güncelle
DROP POLICY IF EXISTS "Users can read own tasks" ON public.gorevler;
CREATE POLICY "Users can read own tasks" ON public.gorevler
  FOR SELECT USING (
    auth.uid() = sofor_id OR 
    auth.uid() = driver_id OR
    driver_id IS NULL
  );

SELECT 'Database hazır! Test edebilirsiniz ✅' as status;
