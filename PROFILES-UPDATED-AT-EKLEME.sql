-- 🔧 PROFILES TABLOSUNA UPDATED_AT KOLONU EKLEMESİ

-- 1. Updated_at kolonunu ekle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Mevcut kayıtları güncelle  
UPDATE public.profiles 
SET updated_at = created_at
WHERE updated_at IS NULL;

-- 3. Updated_at trigger'ı ekle (otomatik güncelleme için)
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;

CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_profiles_updated_at();

-- 4. Test: Aktif şoförler için durum güncelleme
UPDATE public.profiles 
SET 
  aktif = true,
  durum = 'aktif'
WHERE id IN (
  SELECT DISTINCT sofor_id 
  FROM public.gps_kayitlari 
  WHERE timestamp > NOW() - INTERVAL '1 day'
);

-- 5. Kontrol sorgusu
SELECT 
  id,
  ad,
  soyad, 
  aktif,
  durum,
  created_at,
  updated_at
FROM public.profiles 
ORDER BY updated_at DESC 
LIMIT 5;
