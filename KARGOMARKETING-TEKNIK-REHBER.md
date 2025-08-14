# KargoMarketing GPS Takip Sistemi - Teknik Entegrasyon Rehberi

## 🎯 SİSTEM GENEL BAKIŞ

### Akış Diyagramı

```
[KargoMarketing Dashboard] 
          ↓
    [İş Emri Oluştur Modal]
          ↓
    [Supabase 2 - GPS Backend]
          ↓
    [TC Kimlik Eşleştirme]
          ↓
    [Şoför Mobil App]
          ↓
    [Real-time GPS Takip]
          ↓
    [Dashboard Kart Güncelleme]
```

## 📊 TABLO YAPISI VE SORUMLULUKLAR

### `public.gorevler` Tablosu - KargoMarketing Alanları

| Alan Adı | Veri Tipi | KargoMarketing Sorumluluğu | Açıklama |
|----------|-----------|----------------------------|----------|
| **YAZMA YETKİSİ (INSERT)** |
| `ilan_no` | VARCHAR(50) | ✅ **ZORUNLU** | Unique iş emri numarası |
| `tc_kimlik` | VARCHAR(11) | ✅ **ZORUNLU** | Şoförün TC kimlik no (11 haneli) |
| `sofor_adi` | VARCHAR(100) | ✅ **ZORUNLU** | Şoförün adı soyadı |
| `musteri_bilgisi` | TEXT | ✅ Opsiyonel | Müşteri adı, telefon, notlar |
| `ilan_aciklama` | TEXT | ✅ Opsiyonel | İş detayları, özel talepler |
| `teslimat_adresi` | TEXT | ✅ **ZORUNLU** | Teslimat yapılacak adres |
| `baslangic_adresi` | TEXT | ✅ Opsiyonel | Başlangıç noktası |
| **OKUMA YETKİSİ (SELECT)** |
| `id` | UUID | 📖 Sistem | Görev benzersiz ID'si |
| `sofor_id` | UUID | 📖 Sistem | Eşleşen şoförün ID'si |
| `kabul_edildi_mi` | BOOLEAN | 📖 Şoför | Şoförün kabul durumu |
| `son_konum_lat` | DECIMAL | 📖 GPS | Son GPS latitude |
| `son_konum_lng` | DECIMAL | 📖 GPS | Son GPS longitude |
| `sefer_durumu` | VARCHAR(20) | 📖 Şoför | yolda/tamamlandi/iptal |
| `durum` | VARCHAR(20) | 📖 Sistem | Eşleştirme durumu |
| `created_at` | TIMESTAMP | 📖 Sistem | Oluşturma zamanı |
| `updated_at` | TIMESTAMP | 📖 Sistem | Son güncelleme |

## 🔐 API AUTHENTİCATİON

### Supabase Bağlantı Bilgileri

```javascript
const supabaseUrl = 'YOUR_GPS_BACKEND_URL'
const supabaseKey = 'YOUR_GPS_BACKEND_ANON_KEY'

// API Authentication için
const API_KEY = 'KARGOMARKETING_SECRET_KEY_2025'
```

### Authentication Function Çağrısı

```javascript
// Her API çağrısından önce authentication
const { data: authResult } = await supabase.rpc('authenticate_kargomarketing_api', {
  api_key: API_KEY
});

if (!authResult) {
  throw new Error('API Authentication failed');
}
```

## 📝 İŞ EMRİ OLUŞTURMA (MODAL)

### 🚛 TEK ARAÇ MODAL (Basit Kullanım)

```html
<form id="is-emri-form">
  <!-- ZORUNLU ALANLAR -->
  <input name="ilan_no" placeholder="İş Emri No: NT2025001" required />
  <input name="tc_kimlik" placeholder="TC Kimlik: 12345678901" maxlength="11" required />
  <input name="sofor_adi" placeholder="Şoför Adı: Ahmet Demir" required />
  <textarea name="teslimat_adresi" placeholder="Teslimat Adresi" required></textarea>
  
  <!-- OPSİYONEL ALANLAR -->
  <textarea name="musteri_bilgisi" placeholder="Müşteri: ABC Ltd, Tel: 555-1234"></textarea>
  <input name="baslangic_adresi" placeholder="Başlangıç Adresi" />
  <textarea name="ilan_aciklama" placeholder="Özel talepler, dikkat edilecekler"></textarea>
</form>
```

### 🚛🚛🚛 ÇOKLU ARAÇ MODAL (Gelişmiş Kullanım)

**💡 Kullanım Senaryosu:** 1 ilan numarası için birden fazla araç atamak istiyorsunuz.

```html
<div id="multi-vehicle-modal" class="modal">
  <div class="modal-content">
    <h3>🚛 Çoklu Araç İş Emri Oluştur</h3>
    
    <!-- ANA İLAN BİLGİLERİ (ORTAK) -->
    <div class="main-job-info">
      <h4>📋 Ana İş Bilgileri</h4>
      <input id="base-ilan-no" placeholder="Ana İlan No: NT220251405" required />
      <textarea id="main-teslimat-adresi" placeholder="Teslimat Adresi (Tüm araçlar için ortak)" required></textarea>
      <textarea id="main-musteri-bilgisi" placeholder="Müşteri Bilgileri (Ortak)"></textarea>
      <textarea id="main-ilan-aciklama" placeholder="İş Açıklaması (Ortak)"></textarea>
    </div>

    <!-- ARAÇ LİSTESİ (DİNAMİK) -->
    <div id="vehicles-container">
      <!-- JavaScript ile dinamik oluşturulacak -->
    </div>

    <!-- KONTROL BUTONLARI -->
    <div class="modal-actions">
      <button type="button" onclick="addVehicle()" class="add-vehicle-btn">
        ➕ Araç Ekle
      </button>
      <button type="button" onclick="submitAllJobs()" class="submit-all-btn">
        ✅ Tüm İş Emirlerini Onayla (0 Araç)
      </button>
      <button type="button" onclick="closeModal()" class="cancel-btn">
        ❌ İptal
      </button>
    </div>
  </div>
</div>

<!-- ARAÇ FORM ŞABLONu -->
<template id="vehicle-form-template">
  <div class="vehicle-form-card" data-vehicle-index="{index}">
    <div class="vehicle-header">
      <h4>🚛 Araç {index}</h4>
      <span class="auto-ilan-no">{autoIlanNo}</span>
      <button type="button" onclick="removeVehicle({index})" class="remove-btn">❌</button>
    </div>
    
    <div class="vehicle-fields">
      <input 
        name="vehicle-tc-{index}" 
        placeholder="Şoför TC Kimlik: 12345678901" 
        maxlength="11" 
        required 
      />
      <input 
        name="vehicle-name-{index}" 
        placeholder="Şoför Adı: Ali Veli" 
        required 
      />
      <input 
        name="vehicle-start-address-{index}" 
        placeholder="Bu araç için başlangıç adresi (opsiyonel)" 
      />
      <textarea 
        name="vehicle-notes-{index}" 
        placeholder="Bu araç için özel notlar (opsiyonel)"
      ></textarea>
    </div>
  </div>
</template>
```

### 🔧 ÇOKLU ARAÇ JAVASCRIPT LOGIC

```javascript
// ÇOKLU ARAÇ MODAL KONTROL SİSTEMİ
class MultiVehicleJobManager {
  constructor() {
    this.vehicles = [];
    this.baseIlanNo = '';
    this.mainJobData = {};
  }

  // Yeni araç ekle
  addVehicle() {
    const index = this.vehicles.length + 1;
    const suffix = String.fromCharCode(64 + index); // A, B, C, D...
    
    // Base ilan no güncelle
    this.baseIlanNo = document.getElementById('base-ilan-no').value || 'NT220251405';
    const autoIlanNo = `${this.baseIlanNo}-${suffix}`;
    
    const vehicle = {
      index: index,
      ilan_no: autoIlanNo,
      tc_kimlik: '',
      sofor_adi: '',
      baslangic_adresi: '',
      vehicle_notes: ''
    };
    
    this.vehicles.push(vehicle);
    this.renderVehicleForm(vehicle);
    this.updateSubmitButton();
  }

  // Araç formu oluştur
  renderVehicleForm(vehicle) {
    const container = document.getElementById('vehicles-container');
    const template = document.getElementById('vehicle-form-template');
    const clone = template.content.cloneNode(true);
    
    // Template değişkenlerini değiştir
    clone.innerHTML = clone.innerHTML
      .replace(/{index}/g, vehicle.index)
      .replace(/{autoIlanNo}/g, vehicle.ilan_no);
    
    container.appendChild(clone);
  }

  // Araç kaldır
  removeVehicle(index) {
    this.vehicles = this.vehicles.filter(v => v.index !== index);
    document.querySelector(`[data-vehicle-index="${index}"]`).remove();
    this.updateSubmitButton();
  }

  // Ana iş verilerini topla
  collectMainJobData() {
    this.baseIlanNo = document.getElementById('base-ilan-no').value;
    this.mainJobData = {
      teslimat_adresi: document.getElementById('main-teslimat-adresi').value,
      musteri_bilgisi: document.getElementById('main-musteri-bilgisi').value,
      ilan_aciklama: document.getElementById('main-ilan-aciklama').value
    };
  }

  // Araç verilerini topla ve birleştir
  collectVehicleData() {
    return this.vehicles.map(vehicle => {
      const vehicleNotes = document.querySelector(`[name="vehicle-notes-${vehicle.index}"]`).value;
      const startAddress = document.querySelector(`[name="vehicle-start-address-${vehicle.index}"]`).value;
      
      return {
        ilan_no: vehicle.ilan_no,
        tc_kimlik: document.querySelector(`[name="vehicle-tc-${vehicle.index}"]`).value,
        sofor_adi: document.querySelector(`[name="vehicle-name-${vehicle.index}"]`).value,
        baslangic_adresi: startAddress || null,
        // Ana job verilerini ekle
        ...this.mainJobData,
        // Araç özel notlarını ana açıklamaya ekle
        ilan_aciklama: vehicleNotes ? 
          `${this.mainJobData.ilan_aciklama || ''}\n[Araç ${vehicle.index} Notu: ${vehicleNotes}]` : 
          this.mainJobData.ilan_aciklama
      };
    });
  }

  // Tüm iş emirlerini gönder
  async submitAllJobs() {
    try {
      if (this.vehicles.length === 0) {
        alert('❌ En az 1 araç eklemelisiniz!');
        return;
      }

      this.collectMainJobData();
      const vehicleData = this.collectVehicleData();
      
      // Validation
      for (const vehicle of vehicleData) {
        if (!vehicle.ilan_no || !vehicle.tc_kimlik || !vehicle.sofor_adi || !vehicle.teslimat_adresi) {
          alert('❌ Tüm zorunlu alanları doldurunuz!');
          return;
        }
      }
      
      // Her araç için ayrı API çağrısı (AYNI ENDPOINT!)
      const results = [];
      for (const vehicle of vehicleData) {
        const result = await createJobOrder(vehicle); // Mevcut API fonksiyonu
        results.push(result);
      }
      
      alert(`✅ ${results.length} iş emri başarıyla oluşturuldu!\n\nOluşturulan İlan Numaraları:\n${results.map(r => r.ilan_no).join('\n')}`);
      this.closeModal();
      
    } catch (error) {
      alert(`❌ Hata: ${error.message}`);
      console.error('Multi-vehicle job creation error:', error);
    }
  }

  // Submit butonu güncelle
  updateSubmitButton() {
    const button = document.querySelector('.submit-all-btn');
    button.textContent = `✅ Tüm İş Emirlerini Onayla (${this.vehicles.length} Araç)`;
    button.disabled = this.vehicles.length === 0;
  }

  // Modal kapat ve temizle
  closeModal() {
    document.getElementById('multi-vehicle-modal').style.display = 'none';
    this.vehicles = [];
    document.getElementById('vehicles-container').innerHTML = '';
    document.getElementById('base-ilan-no').value = '';
    document.getElementById('main-teslimat-adresi').value = '';
    document.getElementById('main-musteri-bilgisi').value = '';
    document.getElementById('main-ilan-aciklama').value = '';
  }
}

// Global instance
const multiVehicleManager = new MultiVehicleJobManager();

// Helper functions
function addVehicle() {
  multiVehicleManager.addVehicle();
}

function removeVehicle(index) {
  multiVehicleManager.removeVehicle(index);
}

function submitAllJobs() {
  multiVehicleManager.submitAllJobs();
}

function closeModal() {
  multiVehicleManager.closeModal();
}

// Modal açma fonksiyonları
function openSingleVehicleModal() {
  document.getElementById('single-vehicle-modal').style.display = 'block';
}

function openMultiVehicleModal() {
  document.getElementById('multi-vehicle-modal').style.display = 'block';
  multiVehicleManager.addVehicle(); // İlk araç otomatik eklenir
}
```

### 🎯 KULLANIM ÖRNEĞİ

**Senaryo:** NT220251405 numaralı iş için 3 araç atamak istiyorsunuz.

1. **Multi-Vehicle Modal Aç**
2. **Ana Bilgileri Gir:**
   - İlan No: `NT220251405`
   - Teslimat Adresi: `İstanbul Atatürk Havalimanı`
   - Müşteri: `ABC Lojistik`

3. **Araçları Ekle:**
   - ➕ Araç Ekle → `NT220251405-A` (Şoför: Ali Veli)
   - ➕ Araç Ekle → `NT220251405-B` (Şoför: Mehmet Can) 
   - ➕ Araç Ekle → `NT220251405-C` (Şoför: Hasan Demir)

4. **Tek Tıkla Gönder:** ✅ Tüm İş Emirlerini Onayla (3 Araç)

### ✅ BACKEND DEĞİŞİKLİĞİ: SIFIR!

- **Aynı API endpoint** kullanılır: `createJobOrder()`
- **Aynı veri formatı** gönderilir
- **Sadece 3 kez çağrılır** (döngü ile)
- **Hiçbir backend değişikliği** gerekmez!

### JavaScript API Çağrısı

```javascript
async function createJobOrder(formData) {
  try {
    // 1. Authentication
    const { data: authResult } = await supabase.rpc('authenticate_kargomarketing_api', {
      api_key: 'KARGOMARKETING_SECRET_KEY_2025'
    });
    
    if (!authResult) {
      throw new Error('Authentication failed');
    }

    // 2. İş emri oluştur
    const { data, error } = await supabase
      .from('gorevler')
      .insert({
        ilan_no: formData.ilan_no,
        tc_kimlik: formData.tc_kimlik,
        sofor_adi: formData.sofor_adi,
        teslimat_adresi: formData.teslimat_adresi,
        musteri_bilgisi: formData.musteri_bilgisi || null,
        baslangic_adresi: formData.baslangic_adresi || null,
        ilan_aciklama: formData.ilan_aciklama || null
      })
      .select();

    if (error) {
      console.error('Supabase Error:', error);
      throw error;
    }

    console.log('İş emri oluşturuldu:', data[0]);
    return data[0];
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

## 📋 DASHBOARD KART YAPISI

### Kart Template

```html
<div class="job-card" data-job-id="{id}">
  <div class="card-header">
    <span class="job-number">{ilan_no}</span>
    <button class="refresh-btn" onclick="refreshJobData('{id}')">🔄 Yenile</button>
  </div>
  
  <div class="job-info">
    <!-- KargoMarketing Bilgileri -->
    <div class="section sent-data">
      <h4>📤 Gönderilen Bilgiler</h4>
      <p><strong>Şoför:</strong> {sofor_adi}</p>
      <p><strong>TC:</strong> {tc_kimlik}</p>
      <p><strong>Teslimat:</strong> {teslimat_adresi}</p>
      <p><strong>Müşteri:</strong> {musteri_bilgisi}</p>
    </div>
    
    <!-- Sistem Geri Dönüşleri -->
    <div class="section received-data">
      <h4>📥 Sistem Durumu</h4>
      <p><strong>Eşleştirme:</strong> <span class="status-{durum}">{durum}</span></p>
      <p><strong>Şoför Kabulü:</strong> {kabul_edildi_mi ? '✅ Kabul Etti' : '⏳ Bekliyor'}</p>
      <p><strong>Sefer Durumu:</strong> <span class="status-{sefer_durumu}">{sefer_durumu}</span></p>
      <p><strong>Son Konum:</strong> {son_konum_lat ? `${son_konum_lat}, ${son_konum_lng}` : 'Henüz yok'}</p>
      <p><strong>Son Güncelleme:</strong> {updated_at}</p>
    </div>
  </div>
</div>
```

## 🔄 REAL-TIME GÜNCELLEMELERİ

### Manuel Yenileme

```javascript
async function refreshJobData(jobId) {
  try {
    const { data: authResult } = await supabase.rpc('authenticate_kargomarketing_api', {
      api_key: 'KARGOMARKETING_SECRET_KEY_2025'
    });

    const { data, error } = await supabase
      .from('gorevler')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    
    updateJobCard(data);
    
  } catch (error) {
    console.error('Refresh error:', error);
  }
}
```

### Otomatik Yenileme (Real-time)

```javascript
// PostgreSQL NOTIFY ile real-time updates
const subscription = supabase
  .channel('job-updates')
  .on('postgres_changes', 
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'gorevler' 
    }, 
    (payload) => {
      console.log('Job updated:', payload.new);
      updateJobCard(payload.new);
    }
  )
  .subscribe();
```

## 📊 DURUM KODLARİ VE ANLAMLARİ

### `durum` Alanı

- `eslesme_bekleniyor` → Sistem şoför arıyor
- `atandi` → Şoför bulundu ve atandı  
- `sofor_bulunamadi` → TC kimlik eşleşmedi

### `sefer_durumu` Alanı

- `beklemede` → Şoför henüz başlamadı
- `yolda` → Şoför sefere başladı
- `tamamlandi` → Teslimat tamamlandı
- `iptal` → İptal edildi

### `kabul_edildi_mi` Alanı

- `true` → Şoför görevi kabul etti
- `false` → Henüz kabul etmedi

## ⚠️ HATA YÖNETİMİ

### Olası Hatalar ve Çözümleri

1. **TC Kimlik Bulunamadı:**

   ```
   durum: "sofor_bulunamadi"
   → Şoför sisteme kayıtlı değil
   ```

2. **Authentication Hatası:**

   ```
   Error: API Authentication failed
   → API key kontrol edin
   ```

3. **Duplicate İlan No:**

   ```
   Error: duplicate key value violates unique constraint
   → ilan_no unique olmalı
   ```

4. **TC Kimlik Format Hatası:**

   ```
   → 11 haneli sayı olmalı
   ```

## 🔧 TEST SENARYOLARI

### 1. Başarılı İş Emri

```javascript
const testData = {
  ilan_no: "NT20250504001",
  tc_kimlik: "12345678901", // Test TC
  sofor_adi: "Test Şoför",
  teslimat_adresi: "Test Mahallesi, Test Cad. No:1, İstanbul",
  musteri_bilgisi: "Test Müşteri - Tel: 555-1234"
};
```

### 2. Expected Response

```javascript
{
  id: "uuid-here",
  ilan_no: "KM2025TEST001",
  durum: "atandi", // veya "sofor_bulunamadi"
  sofor_id: "uuid-or-null",
  created_at: "2025-01-14T10:00:00Z"
}
```

## 📞 TEKNIK DESTEK

### Hata Durumunda Kontrol Edilecekler

1. API key doğru mu?
2. TC kimlik 11 haneli sayı mı?
3. ilan_no unique mı?
4. Zorunlu alanlar dolu mu?

### Log Takibi

```javascript
// Admin logs tablosunu kontrol edin
const { data } = await supabase
  .from('admin_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10);
```

## 🎯 ÖZET CHECKLIST

- [ ] Supabase bağlantı bilgileri alındı
- [ ] API authentication function test edildi  
- [ ] Modal form alanları hazırlandı
- [ ] İş emri oluşturma API'si test edildi
- [ ] Dashboard kart yapısı kodlandı
- [ ] Yenileme fonksiyonu eklendi
- [ ] Hata senaryoları test edildi
- [ ] Real-time updates (opsiyonel) eklendi

---

**Bu rehber KargoMarketing ekibinin GPS takip sistemine başarılı entegrasyonu için hazırlanmıştır.**
