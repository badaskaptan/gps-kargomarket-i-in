# Profiles Tablosu ve Trigger Düzeltme

## Sorun
- handle_new_user() fonksiyonu yanlış kolonlar kullanıyor: `ad`, `soyad`, `aktif`
- Doğru kolonlar: `name`, `email`, `tc_kimlik`, `durum`
- TC kimlik NULL kalıyor ve saçma isimler ekleniyor

## Çözüm 1: Trigger'ı Tamamen Kaldır (Önerilen)

```sql
-- Mevcut trigger'ı kaldır
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Artık profil mobil uygulamada manuel oluşturulacak
```

## Çözüm 2: Trigger'ı Düzelt

```sql
-- Düzeltilmiş handle_new_user fonksiyonu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Sadece temel bilgilerle profil oluştur
  -- TC kimlik ve name kullanıcı tarafından doldurulacak
  INSERT INTO public.profiles (id, email, durum)
  VALUES (NEW.id, NEW.email, 'beklemede')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı yeniden oluştur
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Test Adımları

1. Yukarıdaki SQL'i Supabase SQL Editor'da çalıştır
2. Yeni kullanıcı kayıt ol
3. Profiles tablosunu kontrol et
4. TC kimlik NULL olmalı (mobil uygulamada doldurulacak)

## Mevcut Veriyi Temizle

```sql
-- Yanlış kayıtları temizle
DELETE FROM public.profiles 
WHERE name = 'Ad Yeni Soyad Şoför' OR ad = 'Yeni';

-- Tüm profilleri sıfırla (dikkatli!)
TRUNCATE public.profiles;
```
