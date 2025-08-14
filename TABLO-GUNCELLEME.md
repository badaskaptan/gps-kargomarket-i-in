# Mevcut Tabloları Yeni Tasarıma Uyarlama

## 1. GOREVLER TABLOSU GÜNCELLEMESİ

Mevcut kolonlar eksik. Yeni kolonları ekleyelim:

```sql
-- Eksik kolonları ekle
ALTER TABLE public.gorevler 
ADD COLUMN IF NOT EXISTS tc_kimlik VARCHAR(11),
ADD COLUMN IF NOT EXISTS sofor_adi VARCHAR(100),
ADD COLUMN IF NOT EXISTS musteri_bilgisi TEXT,
ADD COLUMN IF NOT EXISTS ilan_aciklama TEXT,
ADD COLUMN IF NOT EXISTS teslimat_adresi TEXT,
ADD COLUMN IF NOT EXISTS baslangic_adresi TEXT,
ADD COLUMN IF NOT EXISTS kabul_edildi_mi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS son_konum_lat DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS son_konum_lng DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor';

-- Mevcut kolonları güncelle (eğer varsa)
ALTER TABLE public.gorevler 
ALTER COLUMN ilan_no TYPE VARCHAR(50);

-- Indexleri ekle
CREATE INDEX IF NOT EXISTS idx_gorevler_tc_kimlik ON public.gorevler(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor_id ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(durum);
```

## 2. GPS_KAYITLARI TABLOSU GÜNCELLEMESİ

```sql
-- Eksik kolonları ekle
ALTER TABLE public.gps_kayitlari
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS hiz DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS yon INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dogruluk DECIMAL(5,2) DEFAULT 0;

-- NOT NULL constraint'leri ekle (veri varsa dikkatli ol)
-- Önce NULL değerleri temizle
UPDATE public.gps_kayitlari 
SET latitude = 0, longitude = 0 
WHERE latitude IS NULL OR longitude IS NULL;

-- Sonra NOT NULL yap
ALTER TABLE public.gps_kayitlari 
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;

-- Indexleri ekle
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_gorev_id ON public.gps_kayitlari(gorev_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_sofor_id ON public.gps_kayitlari(sofor_id);
```

## 3. PROFILES TABLOSU GÜNCELLEMESİ

```sql
-- Eksik kolonları ekle
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tam_ad VARCHAR(100),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS tc_kimlik VARCHAR(11),
ADD COLUMN IF NOT EXISTS aktif BOOLEAN DEFAULT TRUE;

-- Computed column için tam_ad'ı güncelle (mevcut veriler için)
UPDATE public.profiles 
SET tam_ad = CONCAT(COALESCE(ad, ''), ' ', COALESCE(soyad, ''))
WHERE tam_ad IS NULL;

-- TC kimlik için unique constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_tc_kimlik UNIQUE (tc_kimlik);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_profiles_tc_kimlik ON public.profiles(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON public.profiles(aktif);
```

## 4. ADMIN_LOGS TABLOSU OLUŞTUR (YENİ)

```sql
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type VARCHAR(50) NOT NULL,
  ilan_no VARCHAR(50),
  tc_kimlik VARCHAR(11),
  sofor_adi VARCHAR(100),
  error_details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS aktif et
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_admin_logs_resolved ON public.admin_logs(resolved);
```

## KURULUM TALİMATI:
1. Supabase SQL Editor'ı aç
2. Her başlığı sırayla copy/paste yap
3. Hata alırsan devam et (bazı kolonlar zaten olabilir)
4. Sonra FUNCTIONS ve TRIGGERS'ları kur
