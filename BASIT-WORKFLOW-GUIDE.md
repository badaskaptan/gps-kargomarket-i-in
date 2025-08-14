# 🚀 Basitleştirilmiş Kargomarketing → GPS İş Akışı

## 📋 Yeni Basit Yaklaşım

### **Kargomarketing'den Sadece Minimum Bilgi:**

```json
{
  "ilan_no": "KM2025001",
  "tc_kimlik": "12345678901",
  "sofor_adi": "Ahmet YILMAZ",
  "musteri_bilgisi": "ABC Şirketi",
  "teslimat_adresi": "İstanbul Kadıköy...",
  "ilan_aciklama": "Elektronik ürün teslimatı"
}
```

### **GPS Backend Otomatik Eşleştirme:**

```sql
-- 1. Görev INSERT edildiğinde trigger çalışır
INSERT INTO gorevler (ilan_no, tc_kimlik, sofor_adi, ...)

-- 2. auto_assign_driver() trigger'ı:
--    - TC kimlik ile profiles tablosundan şoför bulur
--    - sofor_id'yi otomatik doldurur
--    - durum = 'atandi' yapar

-- 3. Eğer TC bulunamazsa:
--    - durum = 'sofor_bulunamadi'
--    - Manuel inceleme gerekir
```

## 🎯 **Çok Basit Veri Akışı**

### **1. Kargomarketing → GPS Backend**

```
Kargomarketing: "TC: 12345678901, Ad: Ahmet YILMAZ, İlan: KM001"
                      ↓
GPS Backend: TC ile arama → Şoför bulundu → Otomatik atama
                      ↓
Şoför Mobile App: Yeni görev bildirimi
```

### **2. GPS Backend Database Yapısı**

```sql
-- profiles tablosu (kayıtlı şoförler)
tc_kimlik: "12345678901" (UNIQUE)
ad: "Ahmet"
soyad: "YILMAZ"
tam_ad: "Ahmet YILMAZ" (auto-generated)

-- gorevler tablosu (gelen işler)
tc_kimlik: "12345678901"  -- Kargomarketing'den
sofor_adi: "Ahmet YILMAZ" -- Kargomarketing'den
sofor_id: UUID            -- Otomatik eşleştirme
durum: "atandi"           -- Otomatik atama sonucu
```

### **3. Eşleştirme Durumları**

```
✅ TC Bulundu + Ad Eşleşti → durum: "atandi"
✅ TC Bulundu + Ad Farklı → Profile güncelle + durum: "atandi"
❌ TC Bulunamadı → durum: "sofor_bulunamadi"
```

## 📱 **Mobile App Akışı**

### **Şoför Login:**

```typescript
// 1. TC kimlik ile giriş
const { user } = await supabase.auth.signInWithPassword({
  email: driver.email,
  password: driver.password
});

// 2. Kendi görevlerini getir
const { data: tasks } = await supabase
  .from('gorevler')
  .select('*')
  .eq('sofor_id', user.id)
  .eq('durum', 'atandi');
```

### **Görev Kabul:**

```typescript
// Şoför görevi kabul eder
await supabase
  .from('gorevler')
  .update({ 
    kabul_edildi_mi: true,
    durum: 'kabul_edildi' 
  })
  .eq('id', taskId);
```

## 🔧 **Bridge API Entegrasyonu**

### **Kargomarketing'den Gelen Data:**

```typescript
// Bridge API endpoint'i
POST /api/assign-task
{
  "ilan_no": "KM2025001",
  "tc_kimlik": "12345678901",
  "sofor_adi": "Ahmet YILMAZ",
  "musteri_bilgisi": "...",
  "teslimat_adresi": "..."
}

// GPS Backend'e insert
const { data, error } = await supabase
  .from('gorevler')
  .insert(taskData);
// Trigger otomatik olarak eşleştirme yapar!
```

### **Kargomarketing'e Geri Bildirim:**

```typescript
// Real-time status değişikliği
supabase
  .channel('task_updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'gorevler'
  }, (payload) => {
    // Kargomarketing'e bildir
    notifyKargomarketing(payload.new);
  });
```

## 💡 **Ana Avantajlar**

✅ **Kargomarketing basit:** Sadece TC + Ad + İlan bilgisi  
✅ **Otomatik eşleştirme:** Trigger ile instant matching  
✅ **Hata yönetimi:** TC bulunamazsa manuel inceleme  
✅ **Profile sync:** Ad farklıysa otomatik güncelleme  
✅ **Real-time:** Durum değişiklikleri instant bildirim  

## 🎯 **Sonuç**

**Kargomarketing artık şoför ID'si bilmek zorunda değil!**

**Sadece:**

1. TC Kimlik No
2. Ad Soyad  
3. İlan Bilgileri

**GPS Backend geri kalanını halleder!** 🚀
