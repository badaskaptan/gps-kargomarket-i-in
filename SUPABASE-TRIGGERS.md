# Supabase Triggers - Kolay Kurulum

Bu dosyada Supabase Dashboard'da SQL Editor'a tek tek ekleyebileceğin trigger'lar var.

## ⚠️ HATA GİDERME: Eksik Functions

Eğer "function does not exist" hatası alırsan, önce bu function'ları çalıştır:

```sql
-- GPS TRAKİNG GÜNCELLEME FONKSİYONU (SUPABASE-FUNCTIONS.md'den)
CREATE OR REPLACE FUNCTION public.update_gps_tracking()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.gorevler 
  SET son_konum_lat = NEW.latitude,
      son_konum_lng = NEW.longitude,
      updated_at = NOW()
  WHERE id = NEW.gorev_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```sql
-- REAL-TIME BİLDİRİM FONKSİYONU (SUPABASE-FUNCTIONS.md'den)
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('task_status_changed', 
    json_build_object(
      'event_type', 'task_update',
      'gorev_id', NEW.id,
      'ilan_no', NEW.ilan_no,
      'durum', NEW.durum,
      'sofor_id', NEW.sofor_id,
      'kabul_edildi', NEW.kabul_edildi_mi,
      'tc_kimlik', NEW.tc_kimlik,
      'son_konum', CASE 
        WHEN NEW.son_konum_lat IS NOT NULL 
        THEN json_build_object('lat', NEW.son_konum_lat, 'lng', NEW.son_konum_lng)
        ELSE NULL 
      END,
      'timestamp', NEW.updated_at
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🚀 HIZLI ÇÖZÜM NOTLARI

**Eğer function hatası alıyorsan:**
1. SUPABASE-FUNCTIONS.md dosyasını aç
2. 6 function'ı sırayla SQL Editor'da çalıştır
3. Sonra bu trigger'ları çalıştır

**Function sırası:**
- `handle_new_user()` 
- `match_driver_by_tc()`
- `auto_assign_driver()`
- `authenticate_kargomarketing_api()`
- `update_gps_tracking()` (yukarıda mevcut)
- `notify_task_status_change()` (yukarıda mevcut)

## ⚠️ ÖNEMLİ: Önce SUPABASE-FUNCTIONS.md'deki tüm function'ları kurup sonra bu trigger'ları kur!

## 1. YENİ KULLANICI TRİGGER'I

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 2. OTOMATİK GÖREV ATAMA TRİGGER'I

```sql
DROP TRIGGER IF EXISTS on_new_task_assign ON public.gorevler;
CREATE TRIGGER on_new_task_assign
  BEFORE INSERT ON public.gorevler
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_driver();
```

## 3. GPS GÜNCELLEME TRİGGER'I

```sql
DROP TRIGGER IF EXISTS on_gps_update ON public.gps_kayitlari;
CREATE TRIGGER on_gps_update
  AFTER INSERT ON public.gps_kayitlari
  FOR EACH ROW EXECUTE FUNCTION public.update_gps_tracking();
```

## 4. GÖREV DURUM DEĞİŞİKLİK TRİGGER'I

```sql
DROP TRIGGER IF EXISTS on_task_status_change ON public.gorevler;
CREATE TRIGGER on_task_status_change
  AFTER UPDATE ON public.gorevler
  FOR EACH ROW 
  WHEN (
    OLD.durum IS DISTINCT FROM NEW.durum OR 
    OLD.kabul_edildi_mi IS DISTINCT FROM NEW.kabul_edildi_mi OR
    OLD.son_konum_lat IS DISTINCT FROM NEW.son_konum_lat OR
    OLD.son_konum_lng IS DISTINCT FROM NEW.son_konum_lng
  )
  EXECUTE FUNCTION public.notify_task_status_change();
```

## KURULUM SIRASI:
1. Önce tabloları oluştur (SUPABASE-TABLES.md)
2. Sonra SUPABASE-FUNCTIONS.md'deki tüm function'ları kur
3. Bu dosyadaki function + trigger'ları sırayla kur
4. SUPABASE-RLS-POLICIES.md'deki policy'leri kur

## 📋 TRİGGER AÇIKLAMALARI (Supabase AI Analizi)

### 🔹 on_auth_user_created
- **Tetikleme:** auth.users tablosuna yeni kullanıcı eklendiğinde
- **Fonksiyon:** public.handle_new_user()
- **Amaç:** Her yeni kullanıcı için otomatik profil oluşturma

### 🔹 on_new_task_assign  
- **Tetikleme:** public.gorevler tablosuna yeni görev eklemeden ÖNCE
- **Fonksiyon:** public.auto_assign_driver()
- **Amaç:** TC kimlik ile otomatik şoför eşleştirme

### 🔹 on_gps_update
- **Tetikleme:** public.gps_kayitlari tablosuna yeni kayıt eklendiğinde
- **Fonksiyon:** public.update_gps_tracking()
- **Amaç:** GPS kaydı güncellendiğinde görevdeki son konum alanlarını güncelleme

### 🔹 on_task_status_change
- **Tetikleme:** public.gorevler tablosunda güncelleme yapıldığında
- **Fonksiyon:** public.notify_task_status_change()
- **Koşullar:** Durum, kabul durumu veya konum değiştiğinde
- **Amaç:** Real-time bildirimler (PostgreSQL NOTIFY)

## ⚡ PERFORMANS NOTLARı:
- Trigger'lar BEFORE/AFTER optimizasyonu yapılmış
- WHEN koşulları gereksiz çalışmaları önler
- Security DEFINER ile güvenli çalışma
- DROP IF EXISTS ile çakışma önleme

Bu şekilde sistem hazır olacak!
