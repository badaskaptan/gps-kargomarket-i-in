-- 🔧 PROFILES TABLOSU KOLON EKLEMESİ

-- 1. Eksik kolonları ekle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'beklemede';

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Mevcut kayıtları güncelle  
UPDATE public.profiles 
SET durum = 'aktif',
    updated_at = NOW()
WHERE aktif = true;

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

-- 4. Kontrol sorgusu
SELECT 
  id,
  ad,
  soyad, 
  aktif,
  durum,
  created_at,
  updated_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;
