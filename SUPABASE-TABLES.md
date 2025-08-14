# Supabase Tabloları - Kolay Kurulum

Bu dosyada Supabase Dashboard'da SQL Editor'a ekleyebileceğin temel tablolar var.

## 1. GÖREVLER TABLOSU

```sql
CREATE TABLE public.gorevler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ilan_no VARCHAR(50) UNIQUE NOT NULL,
  tc_kimlik VARCHAR(11) NOT NULL,
  sofor_adi VARCHAR(100) NOT NULL,
  musteri_bilgisi TEXT,
  ilan_aciklama TEXT,
  teslimat_adresi TEXT NOT NULL,
  baslangic_adresi TEXT,
  sofor_id UUID REFERENCES auth.users(id),
  kabul_edildi_mi BOOLEAN DEFAULT FALSE,
  son_konum_lat DECIMAL(10,8),
  son_konum_lng DECIMAL(11,8),
  sefer_durumu VARCHAR(20) DEFAULT 'beklemede',
  durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 2. GPS KAYITLARI TABLOSU

```sql
CREATE TABLE public.gps_kayitlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gorev_id UUID REFERENCES public.gorevler(id) ON DELETE CASCADE,
  sofor_id UUID REFERENCES auth.users(id) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  hiz DECIMAL(5,2) DEFAULT 0,
  yon INTEGER DEFAULT 0,
  dogruluk DECIMAL(5,2) DEFAULT 0,
  konum_verisi JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 3. PROFİLLER TABLOSU

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ad VARCHAR(50) NOT NULL,
  soyad VARCHAR(50) NOT NULL,
  tam_ad VARCHAR(100) GENERATED ALWAYS AS (CONCAT(ad, ' ', soyad)) STORED,
  telefon VARCHAR(15),
  email VARCHAR(255),
  plaka VARCHAR(10),
  tc_kimlik VARCHAR(11) UNIQUE NOT NULL,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 4. ADMİN LOGS TABLOSU (MEVCUT YAPI ÜZERİNE GÜNCEL)

```sql
-- Mevcut tablo yapısı (values kontrol edilmiş):
-- id: bigint (AUTO INCREMENT)
-- log_type: text NOT NULL  
-- tc_kimlik: varchar(11)
-- sofor_adi: text
-- error_details: jsonb
-- description: text
-- severity: text
-- resolved: boolean DEFAULT FALSE
-- created_at: timestamp with time zone

-- Eğer tablo yoksa oluştur (yoksa bu adımı atla):
CREATE TABLE public.admin_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  log_type TEXT NOT NULL,
  tc_kimlik VARCHAR(11),
  sofor_adi TEXT,
  error_details JSONB,
  description TEXT,
  severity TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## ✅ TABLO DURUMU KONTROL EDİLDİ:
- `admin_logs` ✅ (id: bigint, extra fields: description, severity)  
- `gorevler` ✅
- `gps_kayitlari` ✅ 
- `profiles` ✅

## KURULUM SIRASI:
1. Bu dosyadaki 4 tabloyu sırayla oluştur
2. SUPABASE-FUNCTIONS.md'deki function'ları kur
3. SUPABASE-TRIGGERS.md'deki trigger'ları kur  
4. SUPABASE-RLS-POLICIES.md'deki policy'leri kur

Hepsi kurulduktan sonra sistem çalışmaya hazır!
