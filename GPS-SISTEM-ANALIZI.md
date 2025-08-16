# 🚀 GPS TAKİP SİSTEMİ - DETAYLI ANALİZ

## 📊 SİSTEM MİMARİSİ ÖZET

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ KargoMarketing  │───▶│    gorevler      │◄──▶│ Mobile App      │    │  KargoMarketing  │
│   Backend       │    │   (Ana Tablo)    │    │  (GPS Şoför)    │    │   Dashboard      │
│ (Görev Oluştur) │    │                  │    │                 │    │ (Canlı Takip)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
                                │                       │                       ▲
                                ▼                       ▼                       │
                       ┌──────────────────┐    ┌─────────────────┐              │
                       │     Trigger      │    │  gps_kayitlari  │              │
                       │  (Otomatik TC    │    │  (Ham GPS Data) │              │
                       │   Eşleştirme)    │    │                 │              │
                       └──────────────────┘    └─────────────────┘              │
                                                       │                       │
                                                       ▼                       │
                                              ┌─────────────────┐              │
                                              │   gps_tracking  │──────────────┘
                                              │ (İşlenmiş GPS)  │
                                              │ (KM Dashboard)  │
                                              └─────────────────┘
```

## 📋 TABLOLAR VE KOLON DETAYLARI

### 1️⃣ **gorevler** (Ana Görev Tablosu)

**Kim Ne Zaman Veri Ekliyor:**
- **KargoMarketing Backend**: Yeni görev oluşturulduğunda
- **Trigger**: TC kimlik eşleştirmesi sonrası
- **Mobile App**: Şoför kabul/red, sefer başlat/bitir

```sql
CREATE TABLE gorevler (
  -- KargoMarketing'den gelen veriler
  ilan_no VARCHAR(50) UNIQUE NOT NULL,           -- 📝 KM: Benzersiz görev no
  tc_kimlik VARCHAR(11) NOT NULL,                -- 🆔 KM: Şoför TC kimlik
  sofor_adi VARCHAR(100) NOT NULL,               -- 👤 KM: Şoför adı
  musteri_bilgisi TEXT,                          -- 📋 KM: Müşteri detayları
  teslimat_adresi TEXT NOT NULL,                 -- 📍 KM: Teslimat adresi
  
  -- Trigger tarafından doldurulur
  sofor_id UUID REFERENCES auth.users(id),      -- 🔗 Trigger: Eşleşen şoför ID
  durum VARCHAR(20) DEFAULT 'eslesme_bekleniyor', -- 📊 Trigger: Görev durumu
  
  -- Mobile App tarafından doldurulur
  kabul_edildi_mi BOOLEAN DEFAULT FALSE,         -- ✅ Mobile: Şoför kabulü
  sefer_durumu VARCHAR(20) DEFAULT 'beklemede',  -- 🚛 Mobile: Sefer durumu
  baslangic_zamani TIMESTAMP,                    -- ⏰ Mobile: Sefer başlangıç
  bitis_zamani TIMESTAMP,                        -- ⏰ Mobile: Sefer bitiş
  
  -- GPS Trigger tarafından güncellenir  
  son_konum_lat DECIMAL(10,8),                   -- 📍 GPS: Son latitude
  son_konum_lng DECIMAL(11,8),                   -- 📍 GPS: Son longitude
);
```

**Veri Akışı:**
1. **KargoMarketing** → `ilan_no, tc_kimlik, sofor_adi, teslimat_adresi`
2. **Trigger** → `sofor_id, durum` (TC eşleştirme sonrası)
3. **Mobile App** → `kabul_edildi_mi, sefer_durumu, baslangic_zamani, bitis_zamani`
4. **GPS Trigger** → `son_konum_lat, son_konum_lng` (GPS'ten gelen son konum)

---

### 2️⃣ **gps_kayitlari** (Ham GPS Verileri)

**Kim Veri Ekliyor:** Sadece **Mobile App** (Şoför telefonu)

```sql
CREATE TABLE gps_kayitlari (
  gorev_id UUID REFERENCES gorevler(id),         -- 🔗 Hangi göreve ait
  sofor_id UUID REFERENCES auth.users(id),      -- 👤 Hangi şoför
  
  -- Ham GPS koordinatları (Mobile App'den)
  latitude DECIMAL(10,8) NOT NULL,               -- 📍 Enlem
  longitude DECIMAL(11,8) NOT NULL,              -- 📍 Boylam  
  hiz DECIMAL(5,2) DEFAULT 0,                    -- 🚗 Hız (km/saat)
  yon INTEGER DEFAULT 0,                         -- 🧭 Yön (0-360 derece)
  dogruluk DECIMAL(5,2) DEFAULT 0,               -- 🎯 GPS doğruluk (metre)
  
  -- KargoMarketing için metadata (Mobile App'den)
  konum_verisi JSONB,                            -- 📱 Device + GPS metadata
  
  timestamp TIMESTAMP DEFAULT NOW()              -- ⏰ Kayıt zamanı
);
```

**Mobile App'den Gelen `konum_verisi` JSONB İçeriği:**
```json
{
  "device_info": {
    "model": "Samsung Galaxy A54",              // 📱 Telefon modeli
    "os": "Android 13",                         // 🤖 İşletim sistemi
    "app_version": "2.1.3",                     // 📦 Uygulama versiyonu
    "battery_level": 85,                        // 🔋 Batarya seviyesi
    "signal_strength": 4                        // 📶 Sinyal gücü
  },
  "gps_metadata": {
    "satellites": 8,                            // 🛰️ Uydu sayısı
    "hdop": 1.2,                               // 📐 GPS doğruluk faktörü
    "altitude": 45.5,                          // ⛰️ Rakım
    "speed_accuracy": 0.5,                     // 🎯 Hız doğruluğu
    "bearing_accuracy": 2.1                    // 🧭 Yön doğruluğu
  },
  "timestamp_device": "2025-08-16T10:30:15Z",  // ⏰ Device timestamp
  "location_source": "GPS",                     // 📡 Konum kaynağı
  "collection_method": "automatic"              // 🔄 Toplama yöntemi
}
```

**Veri Sıklığı:** Her 10 saniyede bir (Mobile App tarafından)

---

### 3️⃣ **gps_tracking** (KargoMarketing Dashboard)

**Kim Veri Ekliyor:** **Trigger** (gps_kayitlari'ndan otomatik)

```sql
CREATE TABLE gps_tracking (
  id BIGSERIAL NOT NULL,                        -- 🔢 Auto increment ID
  gorev_id UUID UNIQUE,                         -- 🔗 Görev ID (Benzersiz!)
  
  -- İşlenmiş GPS verileri (Trigger'dan)
  latitude NUMERIC(10, 8) NOT NULL,             -- 📍 Son enlem
  longitude NUMERIC(11, 8) NOT NULL,            -- 📍 Son boylam
  hiz INTEGER NULL,                             -- 🚗 Son hız
  yon INTEGER NULL,                             -- 🧭 Son yön
  dogruluk INTEGER NULL,                        -- 🎯 Son doğruluk
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- ⏰ İlk kayıt
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- ⏰ Son güncelleme
);
```

**Önemli:** 
- Bu tablo **UNIQUE (gorev_id)** constraint'i var
- Her görev için **tek kayıt** tutulur
- **UPSERT** ile sürekli güncellenir
- KargoMarketing Dashboard buradan **canlı takip** yapar

---

## 🔄 VERİ AKIŞI DETAYları

### 📱 Mobile App GPS Fonksiyonu (`sendGPSData`)

```typescript
const sendGPSData = async (location, taskId, userId) => {
  // 1. Device bilgilerini topla
  const deviceInfo = {
    model: Device.modelName || 'Unknown',           // expo-device
    os: `${Device.osName} ${Device.osVersion}`,     // expo-device  
    app_version: Application.nativeApplicationVersion, // expo-application
    battery_level: 85,                              // Static (expo-battery gerekli)
    signal_strength: 4                              // Static (native API gerekli)
  };

  // 2. GPS metadata hazırla
  const gpsMetadata = {
    satellites: 8,                                  // Static (expo-location sağlamaz)
    hdop: 1.2,                                     // Static
    altitude: location.coords.altitude || 0,       // expo-location
    speed_accuracy: location.coords.speed || 0,    // expo-location
    bearing_accuracy: location.coords.heading || 0  // expo-location
  };

  // 3. KargoMarketing uyumlu JSONB oluştur
  const konum_verisi = {
    device_info: deviceInfo,
    gps_metadata: gpsMetadata,
    timestamp_device: new Date().toISOString(),
    location_source: "GPS",
    collection_method: "automatic"
  };

  // 4. gps_kayitlari tablosuna ekle
  await supabase.from('gps_kayitlari').insert({
    gorev_id: taskId,                              // ➡️ Aktif görev ID
    sofor_id: userId,                              // ➡️ Giriş yapan şoför ID
    latitude: location.coords.latitude,            // ➡️ expo-location'dan
    longitude: location.coords.longitude,          // ➡️ expo-location'dan
    hiz: location.coords.speed || 0,              // ➡️ expo-location'dan
    yon: location.coords.heading || 0,            // ➡️ expo-location'dan
    dogruluk: location.coords.accuracy || 0,      // ➡️ expo-location'dan
    konum_verisi: konum_verisi                    // ➡️ KargoMarketing metadata
  });
};
```

### 🔄 Trigger İşlemi (`update_gps_tracking`)

```sql
CREATE OR REPLACE FUNCTION update_gps_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. gorevler tablosunu güncelle (son konum)
  UPDATE gorevler 
  SET son_konum_lat = NEW.latitude,              -- ➡️ gps_kayitlari'ndan
      son_konum_lng = NEW.longitude,             -- ➡️ gps_kayitlari'ndan
      updated_at = NOW()                         -- ➡️ Güncelleme zamanı
  WHERE id = NEW.gorev_id;
  
  -- 2. gps_tracking tablosunu güncelle (KargoMarketing için)
  INSERT INTO gps_tracking (
    gorev_id, latitude, longitude, hiz, yon, dogruluk, created_at, updated_at
  ) VALUES (
    NEW.gorev_id,                                -- ➡️ gps_kayitlari'ndan
    NEW.latitude,                                -- ➡️ gps_kayitlari'ndan  
    NEW.longitude,                               -- ➡️ gps_kayitlari'ndan
    NEW.hiz,                                     -- ➡️ gps_kayitlari'ndan
    NEW.yon,                                     -- ➡️ gps_kayitlari'ndan
    NEW.dogruluk,                                -- ➡️ gps_kayitlari'ndan
    NEW.timestamp,                               -- ➡️ gps_kayitlari'ndan
    NEW.timestamp                                -- ➡️ gps_kayitlari'ndan
  )
  ON CONFLICT (gorev_id)                         -- 🔄 Aynı görev varsa güncelle
  DO UPDATE SET
    latitude = EXCLUDED.latitude,                -- ➡️ Yeni koordinat
    longitude = EXCLUDED.longitude,              -- ➡️ Yeni koordinat
    hiz = EXCLUDED.hiz,                          -- ➡️ Yeni hız
    yon = EXCLUDED.yon,                          -- ➡️ Yeni yön
    dogruluk = EXCLUDED.dogruluk,                -- ➡️ Yeni doğruluk
    updated_at = EXCLUDED.updated_at;            -- ➡️ Güncelleme zamanı
  
  RETURN NEW;
END;
```

### 🎯 Trigger Çalışma Zamanı

```sql
CREATE TRIGGER on_gps_update
  AFTER INSERT ON gps_kayitlari                 -- ✅ gps_kayitlari'na her yeni kayıt
  FOR EACH ROW EXECUTE FUNCTION update_gps_tracking(); -- ⚡ Otomatik trigger
```

---

## 📋 WORKFLOW (Adım Adım)

### 1️⃣ **Görev Oluşturma** (KargoMarketing)
```
KargoMarketing → gorevler tablosu
├── ilan_no: "KM2025001"
├── tc_kimlik: "12345678901"  
├── sofor_adi: "Ahmet Yılmaz"
├── teslimat_adresi: "İstanbul Kadıköy..."
└── durum: "eslesme_bekleniyor"
```

### 2️⃣ **TC Kimlik Eşleştirme** (Trigger)
```
Trigger auto_assign_driver()
├── profiles tablosunda tc_kimlik ara
├── Eşleşme bulunursa:
│   ├── sofor_id: UUID ata
│   ├── durum: "atandi" 
│   └── sefer_durumu: "atandi"
└── Eşleşme yoksa:
    ├── durum: "sofor_bulunamadi"
    └── sefer_durumu: "beklemede"
```

### 3️⃣ **Şoför Giriş** (Mobile App)
```
Mobile App
├── TC kimlik ile eşleşen görevleri al
├── gorevler.sofor_id = session.user.id
└── Görevleri listele
```

### 4️⃣ **Görev Kabul** (Mobile App)
```
acceptTask() fonksiyonu
├── durum: "atandi" güncelle
├── kabul_edildi_mi: true güncelle  
└── Şoför artık sefer başlatabilir
```

### 5️⃣ **Sefer Başlatma** (Mobile App)
```
startGPSTracking() fonksiyonu
├── sefer_durumu: "yolda" güncelle
├── baslangic_zamani: timestamp kaydet
├── GPS izin al (expo-location)
├── İlk konum al
└── sendGPSData() çağır → gps_kayitlari'na kaydet
```

### 6️⃣ **GPS Takip** (Her 10 saniye)
```
setInterval(() => {
  Location.getCurrentPositionAsync() 
  ├── Yeni konum al
  ├── sendGPSData() çağır  
  └── gps_kayitlari'na kaydet
    ├── latitude, longitude, hiz, yon, dogruluk
    └── konum_verisi JSONB (device + GPS metadata)
}, 10000)
```

### 7️⃣ **Otomatik Trigger** (Her GPS kaydında)
```
gps_kayitlari INSERT → Trigger tetiklenir
├── gorevler.son_konum_lat/lng güncelle
└── gps_tracking UPSERT (gorev_id bazında tek kayıt)
    ├── latitude, longitude, hiz, yon, dogruluk
    └── updated_at timestamp
```

### 8️⃣ **KargoMarketing Dashboard**
```
KargoMarketing Dashboard
├── gps_tracking tablosunu oku (RLS policy ile)
├── gorev_id bazında son konum göster
└── Real-time harita üzerinde takip
```

### 9️⃣ **Sefer Tamamlama** (Mobile App)
```
stopGPSTracking() fonksiyonu  
├── sefer_durumu: "tamamlandi" güncelle
├── bitis_zamani: timestamp kaydet
├── GPS tracking'i durdur
└── Son konum gps_kayitlari'na kaydet
```

---

## 🔧 ÖNEMLİ TEKNIK DETAYLAR

### 📊 **Tablo İlişkileri**
- `gorevler` ← **Master** (Ana görev bilgileri)
- `gps_kayitlari` ← **Detay** (Tüm GPS geçmişi)  
- `gps_tracking` ← **Özet** (Son konum - KargoMarketing için)

### 🚀 **Performans**
- `gps_tracking` tek kayıt per görev (UNIQUE constraint)
- `gps_kayitlari` tüm geçmiş (büyük tablo)
- KargoMarketing sadece `gps_tracking` okur (hızlı)

### 🔒 **Güvenlik (RLS)**
- Şoförler sadece kendi GPS'lerini ekleyebilir
- KargoMarketing sadece `gps_tracking` okuyabilir
- Admin tüm verilere erişebilir

### 📱 **Mobile App Kütüphaneler**
- `expo-location`: GPS koordinat
- `expo-device`: Device bilgileri  
- `expo-application`: App versiyonu
- `expo-constants`: Device constants

---

## 🎯 SONUÇ

Bu sistem **3 tablolu** **master-detail** yapısıyla çalışıyor:

1. **`gorevler`** = Ana görev yönetimi (KM + Şoför + GPS)
2. **`gps_kayitlari`** = Ham GPS verileri (Sadece Mobile App)  
3. **`gps_tracking`** = İşlenmiş GPS özeti (Sadece KargoMarketing Dashboard)

**Veri akışı tamamen otomatik** ve **trigger-based** çalışıyor! 🚀
