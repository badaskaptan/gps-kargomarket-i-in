# 🚚 Kargomarketing.com - GPS Takip Sistemi Entegrasyonu

## 📋 Proje Özeti

**Amaç:** Kargomarketing.com web sitesinden GPS takip sistemine ilan bilgilerini otomatik gönderim

**Senaryo:** 
- Kargomarketing.com'da yeni bir kargo ilanı oluşturulduğunda
- Bu ilan bilgileri otomatik olarak GPS takip backend'ine gönderilmeli
- Şoför mobil uygulamada ilan_no ile görevi bulabilmeli

---

## 🏗️ Sistem Mimarisi

### Backend Yapısı
```
┌─────────────────┐    API Call    ┌──────────────────┐
│ Kargomarketing  │ ──────────────► │ GPS Takip       │
│ Supabase        │                │ Supabase         │
│ (tbepkrfktj...) │                │ (rmqwrdeaecj...) │
└─────────────────┘                └──────────────────┘
```

### Data Flow
1. **Kargomarketing.com:** Yeni ilan oluştur
2. **Frontend:** API call tetikle  
3. **GPS Backend:** Edge Function ile ilan bilgilerini kaydet
4. **Mobil App:** Şoför ilan_no ile görevi alabilir

---

## 🎯 Yapılacak İşlemler

### 1. Kargomarketing.com Frontend Kodu
**Lokasyon:** Yeni ilan oluşturma sayfası (form submit sonrası)

**Gerekli API Call:**
```javascript
// GPS Backend'e ilan bilgilerini gönder
const response = await fetch('https://rmqwrdeaecjyyalbnvbq.supabase.co/functions/v1/add-gps-task', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    ilan_no: "KRG2025XXX",           // Benzersiz ilan numarası
    customer_info: "Müşteri Adı",    // Müşteri bilgileri
    delivery_address: "Teslimat Adresi", // Teslimat adresi
    api_key: "KARGOMARKETING_API_KEY_2025" // Güvenlik anahtarı
  })
});
```

### 2. Entegrasyon Timing'i
- **Ne zaman tetiklenmeli:** İlan başarıyla kargomarketing veritabanına kaydedildikten SONRA
- **Nerede:** Form submit success callback'inde
- **Error handling:** GPS backend'e gönderim başarısız olursa loglama

---

## 🔧 Teknik Detaylar

### GPS Backend Edge Function Endpoint
```
URL: https://rmqwrdeaecjyyalbnvbq.supabase.co/functions/v1/add-gps-task
Method: POST
Content-Type: application/json
```

### Request Body Schema
```typescript
interface GPSTaskRequest {
  ilan_no: string;           // Örnek: "KRG2025001"
  customer_info: string;     // Müşteri adı/firma
  delivery_address: string;  // Tam teslimat adresi
  api_key: string;          // "KARGOMARKETING_API_KEY_2025"
}
```

### Response Schema
```typescript
// Success (200)
{
  success: true,
  message: "Task created successfully",
  task_id: 123,
  ilan_no: "KRG2025001"
}

// Error (400/401/409/500)
{
  error: "Error message"
}
```

### HTTP Status Codes
- **200:** Başarılı
- **400:** Eksik parametreler
- **401:** Geçersiz API key
- **409:** İlan numarası zaten mevcut
- **500:** Sunucu hatası

---

## 📝 Implementation Checklist

### Frontend Developer İçin Görevler:

#### ✅ Hazırlık
- [ ] Kargomarketing.com projesini VS Code'da aç
- [ ] Mevcut ilan oluşturma form'unu tespit et
- [ ] Form submit success callback'ini bul

#### ✅ API Integration Kodu
- [ ] GPS backend API call fonksiyonu yaz
- [ ] Error handling ekle
- [ ] Success/error mesajları kullanıcıya göster
- [ ] Console log'lar ekle (debug için)

#### ✅ Test Senaryoları
- [ ] Başarılı ilan gönderimi
- [ ] Duplicate ilan_no error handling
- [ ] Network error handling
- [ ] API key validation

---

## 🧪 Test Verisi

### Test İçin Örnek Data
```javascript
const testData = {
  ilan_no: "KRG2025TEST001",
  customer_info: "Test Kargo Müşterisi A.Ş.",
  delivery_address: "İstanbul Kadıköy Moda Mahallesi Test Sokak No:1",
  api_key: "KARGOMARKETING_API_KEY_2025"
};
```

### Browser Console Test
```javascript
// Bu kodu browser console'da çalıştırarak test edebilirsin
fetch('https://rmqwrdeaecjyyalbnvbq.supabase.co/functions/v1/add-gps-task', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ilan_no: "KRG2025TEST002",
    customer_info: "Console Test Müşteri",
    delivery_address: "Ankara Test Mahallesi",
    api_key: "KARGOMARKETING_API_KEY_2025"
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

---

## 🚨 Güvenlik ve Error Handling

### API Key Security
- API key'i environment variable olarak sakla
- Production'da farklı key kullan
- Key'i frontend kodunda hardcode etme

### Error Scenarios
```javascript
// Example error handling
try {
  const response = await fetch(GPS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error('GPS Backend Error:', errorData.error);
    
    // User-friendly error message
    if (response.status === 409) {
      alert('Bu ilan numarası zaten GPS sisteminde mevcut.');
    } else {
      alert('GPS sistemine bağlanırken hata oluştu. Lütfen tekrar deneyin.');
    }
    return;
  }
  
  const successData = await response.json();
  console.log('GPS Task Created:', successData);
  
  // Success message to user
  alert('İlan GPS takip sistemine başarıyla gönderildi!');
  
} catch (error) {
  console.error('Network Error:', error);
  alert('Ağ hatası. İnternet bağlantınızı kontrol edin.');
}
```

---

## 📞 Debug ve Destek

### Debug Bilgileri
- **GPS Backend Project ID:** rmqwrdeaecjyyalbnvbq
- **Edge Function Name:** add-gps-task
- **API Key:** KARGOMARKETING_API_KEY_2025

### Browser Console'da Kontrol
```javascript
// API call sonrası bu komutları çalıştır:
console.log('Request sent to GPS backend');
console.log('Response status:', response.status);
console.log('Response data:', await response.json());
```

### Supabase Dashboard Kontrol
- GPS Backend: https://supabase.com/dashboard/project/rmqwrdeaecjyyalbnvbq
- Functions > add-gps-task > Logs
- Table Editor > gorevler tablosu

---

## 🎯 Sonuç

Bu entegrasyon tamamlandığında:
1. ✅ Kargomarketing.com'da oluşturulan her ilan otomatik olarak GPS sistemine gidecek
2. ✅ Şoförler mobil uygulamada ilan_no ile görevleri bulabilecek  
3. ✅ İki sistem arasında otomatik senkronizasyon sağlanacak

**İletişim:** Herhangi bir teknik sorun için bu dokuman referans alınarak sorular sorulabilir.
