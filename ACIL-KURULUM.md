# 🚀 ACİL KURULUM - Mevcut Sistem İçin

Sen mevcut tabloların var. Sadece bunları güncellemek yeterli:

## ⚡ 1. TAK VE ÇALIŞTIR - SQL KOMUTLARI

Supabase SQL Editor'a bu 4 komutu sırayla yapıştır:

### Adım 1: gorevler tablosunu güncelle

```sql
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS tc_kimlik VARCHAR(11),
ADD COLUMN IF NOT EXISTS sofor_adi VARCHAR(100),
ADD COLUMN IF NOT EXISTS teslimat_adresi TEXT,
ADD COLUMN IF NOT EXISTS kabul_edildi_mi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor';
```

### Adım 2: profiles tablosunu güncelle  

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tc_kimlik VARCHAR(11) UNIQUE,
ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE;
```

### Adım 3: admin_logs tablosu oluştur

```sql
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type VARCHAR(50) NOT NULL,
  tc_kimlik VARCHAR(11),
  sofor_adi VARCHAR(100),
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Adım 4: Yeni kullanıcı profil function'ı ekle

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, ad, soyad, tc_kimlik, aktif)
  VALUES (NEW.id, 'Yeni', 'Şoför', '00000000000', false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Adım 5: TC eşleştirme function'ı ekle

```sql
CREATE OR REPLACE FUNCTION public.match_driver_by_tc(
  tc_kimlik_param VARCHAR(11),
  sofor_adi_param VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
  matched_sofor_id UUID;
BEGIN
  SELECT id INTO matched_sofor_id
  FROM public.profiles 
  WHERE tc_kimlik = tc_kimlik_param AND aktif = TRUE;
  
  IF matched_sofor_id IS NOT NULL THEN
    RETURN matched_sofor_id;
  ELSE
    INSERT INTO public.admin_logs (log_type, tc_kimlik, sofor_adi, error_details)
    VALUES ('driver_not_found', tc_kimlik_param, sofor_adi_param, 
            json_build_object('message', 'TC kimlik bulunamadı'));
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## ⚡ 2. TEST ET

### Test şoförü ekle

```sql
UPDATE public.profiles 
SET tc_kimlik = '12345678901', aktif = true 
WHERE id = (SELECT id FROM public.profiles LIMIT 1);
```

### Test görevi ekle

```sql
INSERT INTO public.gorevler (ilan_no, tc_kimlik, sofor_adi, teslimat_adresi)
VALUES ('TEST001', '12345678901', 'Test Şoför', 'Test Adres');
```

## 🎯 SONUÇ

5 komutu çalıştırdıktan sonra:

- ✅ TC kimlik eşleştirme çalışır
- ✅ Otomatik şoför atama aktif
- ✅ Admin log sistemi hazır
- ✅ Yeni kullanıcı profil sistemi aktif
- ✅ Mobil app bağlanabilir

**HAZIR!** Artık Kargomarketing görev gönderebilir.
