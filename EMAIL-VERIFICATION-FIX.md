# Email Verification Devre Dışı Bırakma

## Supabase Dashboard Ayarları

1. **Supabase Dashboard'a gidin**: https://supabase.com/dashboard
2. **GPS projenizi seçin**
3. **Authentication → Settings** bölümüne gidin
4. **"Enable email confirmations"** seçeneğini **KAPATIN**
5. **Save** butonuna basın

## Alternatif: SQL ile Devre Dışı Bırakma

```sql
-- Email confirmation'ı kapat
UPDATE auth.config 
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'), 
  '{email_confirm}', 
  'false'
);
```

## Test Adımları

1. Yeni kullanıcı kayıt olun
2. Direkt login yapmayı deneyin
3. Email verification hatası almamalısınız

## Not

Bu ayar sadece development için! Production'da email verification açık olmalı.
