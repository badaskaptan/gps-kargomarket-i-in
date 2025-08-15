# 🚨 Supabase Read-Only Hatası Çözümü

## HATA: "cannot execute CREATE TABLE in a read-only transaction"

Bu hata, SQL Editor'da yazma yetkisi olmadığı anlamına gelir.

## ✅ ÇÖZÜM ADAMLARI

### 1️⃣ Service Role Key ile Bağlan

1. **Supabase Dashboard'da:**
   - Settings → API menüsüne git
   - **Service Role Key**'i kopyala (anon key değil!)
   - Bu key yazma yetkisi veriyor

### 2️⃣ SQL Editor Ayarları

1. **SQL Editor'da:**
   - Sol üstteki "RLS" toggle'ını **KAPALI** yap
   - "Use service role" seçeneğini **AÇ**
   - Service Role Key'i yapıştır

### 3️⃣ Alternatif: Table Editor Kullan

1. **Dashboard'da:**
   - Table Editor → Create new table
   - Manuel olarak tabloları oluştur

## 🔄 MANUEL TABLO OLUŞTURMA

### gorevler tablosu

```
Tablo adı: gorevler

Kolonlar:
- id: uuid, primary key, default: gen_random_uuid()
- ilan_no: varchar(50), unique, not null
- tc_kimlik: varchar(11), not null
- sofor_adi: varchar(100), not null
- musteri_bilgisi: text
- ilan_aciklama: text
- teslimat_adresi: text, not null
- baslangic_adresi: text
- sofor_id: uuid, foreign key → auth.users(id)
- kabul_edildi_mi: boolean, default: false
- son_konum_lat: numeric(10,8)
- son_konum_lng: numeric(11,8)
- sefer_durumu: varchar(20), default: 'beklemede'
- durum: varchar(20), default: 'eslesme_bekleniyor'
- created_at: timestamptz, default: now()
- updated_at: timestamptz, default: now()
```

### gps_kayitlari tablosu

```
Tablo adı: gps_kayitlari

Kolonlar:
- id: uuid, primary key, default: gen_random_uuid()
- gorev_id: uuid, foreign key → public.gorevler(id)
- sofor_id: uuid, foreign key → auth.users(id), not null
- latitude: numeric(10,8), not null
- longitude: numeric(11,8), not null
- hiz: numeric(5,2), default: 0
- yon: integer, default: 0
- dogruluk: numeric(5,2), default: 0
- konum_verisi: jsonb
- timestamp: timestamptz, default: now()
```

### profiles tablosu

```
Tablo adı: profiles

Kolonlar:
- id: uuid, primary key, foreign key → auth.users(id)
- ad: varchar(50), not null
- soyad: varchar(50), not null
- tam_ad: varchar(100), computed: CONCAT(ad, ' ', soyad)
- telefon: varchar(15)
- email: varchar(255)
- plaka: varchar(10)
- tc_kimlik: varchar(11), unique, not null
- aktif: boolean, default: true
- created_at: timestamptz, default: now()
```

### admin_logs tablosu

```
Tablo adı: admin_logs

Kolonlar:
- id: uuid, primary key, default: gen_random_uuid()
- log_type: varchar(50), not null
- ilan_no: varchar(50)
- tc_kimlik: varchar(11)
- sofor_adi: varchar(100)
- error_details: jsonb
- resolved: boolean, default: false
- created_at: timestamptz, default: now()
```

## 🎯 EN KOLAY YOL

1. **Table Editor kullan** (UI ile kolay)
2. Tabloları yukarıdaki şemaya göre oluştur
3. Function'ları SQL Editor ile ekle (Service Role Key ile)
4. Policy'leri ekle

Bu şekilde read-only hatası almadan sistemi kurabilirsin!
