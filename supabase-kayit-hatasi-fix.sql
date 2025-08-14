-- GPS Takip - Kayıt Hatası Düzeltme SQL
-- Bu dosyayı Supabase 2 SQL Editor'da çalıştır

-- 1) tc_kimlik kolonunu NULL olabilir yap
ALTER TABLE public.profiles 
  ALTER COLUMN tc_kimlik DROP NOT NULL;

-- 2) Eski tekillik kuralını kaldır
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_tc_kimlik_key;

DROP INDEX IF EXISTS profiles_tc_kimlik_key;

-- 3) Sadece NULL olmayan tc_kimlik'lerde tekillik uygula
CREATE UNIQUE INDEX IF NOT EXISTS profiles_tc_kimlik_unique_not_null
  ON public.profiles (tc_kimlik)
  WHERE tc_kimlik IS NOT NULL;

-- 4) Tetikleyici fonksiyonunu düzelt (dummy TC yazma)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- tc_kimlik NULL bırakılır, sonra gerçek TC ile güncellenir
  INSERT INTO public.profiles (id, ad, soyad, aktif)
  VALUES (NEW.id, 'Yeni', 'Şoför', false);
  RETURN NEW;
END;
$$;

-- 5) auth.users tetikleyicisini yeniden oluştur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Tamamlandı! Artık uygulamada "Kayıt Ol" çalışmalı.
