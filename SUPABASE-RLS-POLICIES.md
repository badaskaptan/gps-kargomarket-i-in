# Supabase RLS Policies - Güncelleme (Mevcut Tablolar İçin)

Bu dosyada mevcut tablolarındaki policy'leri güncelleyeceğin komutlar var.

## 1. ESKİ POLICY'LERİ TEMİZLE

```sql
-- Eski policy'leri sil
DROP POLICY IF EXISTS "Şoförler kendi görevlerini görebilir" ON public.gorevler;
DROP POLICY IF EXISTS "Anon users can update gorevler" ON public.gorevler;
DROP POLICY IF EXISTS "Anon users can insert gorevler" ON public.gorevler;
DROP POLICY IF EXISTS "Anon users can view gorevler" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_update_claim_and_own" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_select_own_or_unassigned" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_insert_own" ON public.gorevler;

DROP POLICY IF EXISTS "Şoförler GPS verisi ekleyebilir" ON public.gps_kayitlari;
DROP POLICY IF EXISTS "Şoförler kendi GPS verilerini görebilir" ON public.gps_kayitlari;

DROP POLICY IF EXISTS "Şoförler kendi profillerini görebilir" ON public.profiles;
```

## 2. RLS'İ AKTİF ET (Zaten aktif ama kontrol için)

```sql
ALTER TABLE public.gorevler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_kayitlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
```

## 2. ŞÖFÖR POLİCY'LERİ

### Şoförler kendi görevlerini görebilir:
```sql
CREATE POLICY "soforler_gorevleri_gorebildir" ON public.gorevler
  FOR SELECT USING (auth.uid() = sofor_id);
```

### Şoförler görev kabul edebilir:
```sql
CREATE POLICY "soforler_gorev_kabul_edebilir" ON public.gorevler
  FOR UPDATE USING (auth.uid() = sofor_id);
```

### Şoförler kendi GPS verilerini görebilir:
```sql
CREATE POLICY "soforler_gps_gorebildir" ON public.gps_kayitlari
  FOR SELECT USING (auth.uid() = sofor_id);
```

### Şoförler GPS verisi ekleyebilir:
```sql
CREATE POLICY "soforler_gps_ekleyebilir" ON public.gps_kayitlari
  FOR INSERT WITH CHECK (auth.uid() = sofor_id);
```

### Şoförler kendi profillerini yönetebilir:
```sql
CREATE POLICY "soforler_profil_yonetir" ON public.profiles
  FOR ALL USING (auth.uid() = id);
```

## 3. KARGOMARKETING API POLİCY'LERİ

### Kargomarketing görev oluşturabilir:
```sql
CREATE POLICY "kargomarketing_gorev_olustur" ON public.gorevler
  FOR INSERT WITH CHECK (
    current_setting('app.user_role', true) = 'kargomarketing_api'
  );
```

### Kargomarketing görevleri okuyabilir:
```sql
CREATE POLICY "kargomarketing_gorevleri_okur" ON public.gorevler
  FOR SELECT USING (
    current_setting('app.user_role', true) = 'kargomarketing_api'
  );
```

### Kargomarketing sınırlı güncelleme yapabilir:
```sql
CREATE POLICY "kargomarketing_sinirli_guncelleme" ON public.gorevler
  FOR UPDATE USING (
    current_setting('app.user_role', true) = 'kargomarketing_api'
    AND sofor_id IS NULL
    AND durum IN ('eslesme_bekleniyor', 'sofor_bulunamadi')
  );
```

## 4. ADMİN POLİCY'LERİ

### Admin log erişimi:
```sql
CREATE POLICY "admin_log_erisimi" ON public.admin_logs
  FOR ALL USING (
    current_setting('app.user_role', true) = 'admin'
  );
```

## 5. PERFORMANS İNDEKSLERİ

```sql
CREATE INDEX IF NOT EXISTS idx_gorevler_tc_kimlik ON public.gorevler(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_gorevler_sofor_id ON public.gorevler(sofor_id);
CREATE INDEX IF NOT EXISTS idx_gorevler_ilan_no ON public.gorevler(ilan_no);
CREATE INDEX IF NOT EXISTS idx_gorevler_durum ON public.gorevler(durum);
CREATE INDEX IF NOT EXISTS idx_profiles_tc_kimlik ON public.profiles(tc_kimlik);
CREATE INDEX IF NOT EXISTS idx_profiles_aktif ON public.profiles(aktif);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_gorev_id ON public.gps_kayitlari(gorev_id);
CREATE INDEX IF NOT EXISTS idx_gps_kayitlari_sofor_id ON public.gps_kayitlari(sofor_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_resolved ON public.admin_logs(resolved);
```

## KULLANIM TALİMATI:
1. Supabase Dashboard'da SQL Editor'ı aç
2. Her başlığı tek tek copy/paste yap ve çalıştır
3. Policy çakışması olursa önce DROP POLICY komutunu çalıştır
4. Sonra tekrar CREATE POLICY çalıştır

Bu şekilde hata almadan tüm policy'leri kurabilirsin.
