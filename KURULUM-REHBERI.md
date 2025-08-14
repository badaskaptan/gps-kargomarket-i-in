# 🚀 GPS Takip Sistemi - Kolay Kurulum Rehberi

Bu rehber ile GPS Backend'ini Supabase'de kolayca kurabilirsin.

## 📋 Kurulum Sırası

### 1️⃣ ADIM: Supabase Projesi Oluştur
1. [Supabase Dashboard](https://app.supabase.com)
2. New Project oluştur
3. Project URL ve ANON KEY'i kopyala
4. `gps-sefer/App.tsx` dosyasında güncellee

### 2️⃣ ADIM: Tabloları Oluştur
1. Supabase Dashboard → SQL Editor
2. `SUPABASE-TABLES.md` dosyasını aç
3. Her tabloyu sırayla copy/paste edip çalıştır:
   - ✅ gorevler tablosu
   - ✅ gps_kayitlari tablosu  
   - ✅ profiles tablosu
   - ✅ admin_logs tablosu

### 3️⃣ ADIM: Function'ları Kur
1. `SUPABASE-FUNCTIONS.md` dosyasını aç
2. Her function'ı sırayla copy/paste edip çalıştır:
   - ✅ match_driver_by_tc
   - ✅ auto_assign_driver
   - ✅ handle_new_user
   - ✅ authenticate_kargomarketing_api
   - ✅ update_gps_tracking
   - ✅ notify_task_status_change

### 4️⃣ ADIM: Trigger'ları Kur
1. `SUPABASE-TRIGGERS.md` dosyasını aç
2. Her trigger'ı sırayla copy/paste edip çalıştır:
   - ✅ on_auth_user_created
   - ✅ on_new_task_assign
   - ✅ on_gps_update
   - ✅ on_task_status_change

### 5️⃣ ADIM: RLS Policy'leri Kur
1. `SUPABASE-RLS-POLICIES.md` dosyasını aç
2. Önce RLS'i aktif et
3. Her policy'yi sırayla copy/paste edip çalıştır

### 6️⃣ ADIM: Test Verisi Ekle
```sql
-- Test şoförü oluştur (Supabase Dashboard → Authentication → Users)
-- Email: test@sofor.com
-- Password: 123456

-- Profil güncelle
UPDATE public.profiles 
SET ad = 'Ahmet', soyad = 'Yılmaz', tc_kimlik = '12345678901', aktif = true
WHERE id = 'USER_ID_BURAYA';

-- Test görevi ekle (Kargomarketing simülasyonu)
INSERT INTO public.gorevler (ilan_no, tc_kimlik, sofor_adi, teslimat_adresi)
VALUES ('ILN001', '12345678901', 'Ahmet Yılmaz', 'İstanbul Test Adres');
```

## ✅ Kurulum Kontrolü

Backend kurulumu tamamlandığında:

1. **Tablolar oluştu mu?** → Supabase Dashboard → Table Editor'da 4 tablo görünmeli
2. **Function'lar çalışıyor mu?** → SQL Editor'da `SELECT public.match_driver_by_tc('12345678901', 'Test');` 
3. **Trigger'lar aktif mi?** → Yeni görev eklendiğinde otomatik eşleşme olmalı
4. **Policy'ler çalışıyor mu?** → RLS aktif olmalı

## 📱 Mobil App Testi

1. `gps-sefer/` klasöründe terminal aç
2. `npm start` çalıştır
3. Expo Go ile QR kod tara
4. Test kullanıcısı ile giriş yap
5. GPS izni ver
6. Görevleri görebiliyor musun?

## 🔧 Sorun Giderme

### Hata: "policy does not exist"
- RLS policy'lerini tekrar kur
- DROP POLICY IF EXISTS komutunu kullan

### Hata: "function does not exist"  
- Function'ları tekrar kur
- CREATE OR REPLACE kullan

### Hata: "table does not exist"
- Tabloları tekrar oluştur
- Sıralama önemli: önce gorevler, sonra diğerleri

### Mobil app bağlanamıyor
- `App.tsx`'de SUPABASE_URL ve SUPABASE_ANON_KEY kontrol et
- İnternet bağlantısını kontrol et

## 🎯 İşe Yaradıysa

Backend hazır! Artık:
- ✅ Şoförler mobil app'le giriş yapabilir
- ✅ TC kimlik eşleştirmesi çalışıyor
- ✅ GPS tracking aktif
- ✅ Real-time bildirimler çalışıyor
- ✅ Kargomarketing API entegrasyonu hazır

**Sonraki adım:** Kargomarketing'den API çağrıları yapmaya başla!
