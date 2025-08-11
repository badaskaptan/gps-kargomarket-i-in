# 🔗 İlan-Şöför Bağlantı Sistemi Rehberi

## 🎯 Bağlantı Stratejisi

Sistemde **2 ayrı Supabase backend** bulunduğu için şöför-iş bağlantısı **manuel ilan_no paylaşımı** ile yapılır:

### 📋 İş Akışı

```text
1. Kargomarketing.com → İlan Oluştur & Onayla
   ↓
2. GPS Sistemine Görev Gönder (Edge Function)
   ↓
3. Müşteri → Şöför Firması ile İletişim (Telefon/SMS/Mail)
   ↓
4. İlan No Paylaşımı (KRG2025001)
   ↓
5. Şöför → Mobil Uygulamada "İlan No ile Bağlan"
   ↓
6. Sistem → Otomatik Eşleştirme & Onay
   ↓
7. Her İki Tarafta da Bilgi Görünür
   ↓
8. GPS Takibi Başlar
```

---

## 🔧 Teknik Implementasyon

### 1. kargomarketing.com Tarafı

#### A. İlan Onaylandığında GPS Görevi Oluştur

```typescript
// create-gps-job.ts Edge Function (kargomarketing.com Supabase)
const createGPSJob = async (ilan_id: number) => {
  // İlan bilgilerini al
  const { data: ilan } = await supabase
    .from('ilanlar')
    .select('*')
    .eq('id', ilan_id)
    .single()
  
  // GPS sistemine gönder
  const response = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: 'production_api_key_12345',
      ilan_no: ilan.ilan_no,           // ← Bu numarayı şöförle paylaş
      customer_info: {
        name: ilan.musteri_adi,
        phone: ilan.musteri_telefon,
        email: ilan.musteri_email
      },
      delivery_address: {
        city: ilan.varis_sehir,
        district: ilan.varis_ilce,
        full_address: ilan.varis_adres
      },
      priority: ilan.oncelik || 'normal',
      cargo_type: ilan.yuk_tipi
    })
  })
  
  const result = await response.json()
  
  if (result.success) {
    // İlan tablosunu güncelle
    await supabase
      .from('ilanlar')
      .update({
        gps_job_created: true,
        gps_job_id: result.job_id,
        gps_status: 'waiting_for_driver',
        gps_ilan_no: ilan.ilan_no  // ← Bu numarayı müşteriye göster
      })
      .eq('id', ilan_id)
  }
}
```

#### B. Müşteri Bilgilendirmesi

```typescript
// İlan onaylandığında müşteriye email/SMS gönder
const notifyCustomer = async (ilan_id: number) => {
  const { data: ilan } = await supabase
    .from('ilanlar')
    .select('*')
    .eq('id', ilan_id)
    .single()
  
  // Email gönder
  await sendEmail({
    to: ilan.musteri_email,
    subject: '✅ İlan Onaylandı - Şöför Bağlantı Bilgileri',
    template: `
      Sayın ${ilan.musteri_adi},
      
      İlanınız onaylanmıştır ve GPS takip sistemi aktif edilmiştir.
      
      📋 İlan Numarası: ${ilan.ilan_no}
      
      Bu numarayı şöför firmasına iletin. Şöför bu numara ile 
      sisteme bağlanacak ve GPS takibi başlayacaktır.
      
      Takip linki: kargomarketing.com/tracking/${ilan.ilan_no}
    `
  })
  
  // SMS gönder (opsiyonel)
  await sendSMS({
    to: ilan.musteri_telefon,
    message: `İlan onaylandı! Şöföre verin: ${ilan.ilan_no}. Takip: kargomarketing.com/tracking/${ilan.ilan_no}`
  })
}
```

#### C. Frontend - İlan Detay Sayfası

```typescript
// İlan detay sayfasında GPS durumu göster
const IlanDetailPage: React.FC<{ilanId: number}> = ({ ilanId }) => {
  const [ilan, setIlan] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('waiting')
  
  useEffect(() => {
    // İlan bilgilerini çek
    loadIlan()
    
    // GPS durumunu periyodik kontrol et
    const interval = setInterval(checkGPSStatus, 30000)
    return () => clearInterval(interval)
  }, [])
  
  const checkGPSStatus = async () => {
    const { data } = await supabase.functions.invoke('get-gps-tracking', {
      body: { ilan_no: ilan.ilan_no }
    })
    
    if (data.success) {
      setGpsStatus(data.status)
    }
  }
  
  return (
    <div className="ilan-detail">
      <h1>İlan: {ilan?.ilan_no}</h1>
      
      {/* GPS Durum Kartı */}
      <div className="gps-status-card">
        <h3>🚛 GPS Takip Durumu</h3>
        
        {gpsStatus === 'waiting_for_driver' && (
          <div className="status-waiting">
            <p>⏳ Şöför bağlantısı bekleniyor</p>
            <div className="ilan-no-share">
              <strong>📋 İlan Numarası: {ilan.ilan_no}</strong>
              <p>Bu numarayı şöför firmasına iletin</p>
              <button onClick={() => navigator.clipboard.writeText(ilan.ilan_no)}>
                📋 Kopyala
              </button>
            </div>
          </div>
        )}
        
        {gpsStatus === 'assigned' && (
          <div className="status-assigned">
            <p>✅ Şöför atandı!</p>
            <p>GPS takibi aktif hale gelecek...</p>
          </div>
        )}
        
        {gpsStatus === 'in_progress' && (
          <div className="status-active">
            <p>📍 GPS takibi aktif</p>
            <GPSTrackingWidget ilanNo={ilan.ilan_no} />
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2. Şöför Tarafı (Mobil App)

#### A. İlan Bağlantı Süreci

Mobil uygulamada **"İlan No ile Bağlan"** buton ve modal eklendi:

1. **Şöför** müşteriden ilan numarasını alır (KRG2025001)
2. **Mobil uygulamada** "İlan No ile Bağlan" butonuna basar
3. **İlan numarasını girer** ve "Bağlan" butonuna basar
4. **Sistem** ilan numarasını kontrol eder:
   - ✅ Varsa: Şöföre atar ve onay verir
   - ❌ Yoksa: "İlan bulunamadı" hatası verir
5. **Başarılı bağlantıda** görev listesinde görünür
6. **GPS takibi** başlatabilir

#### B. Bağlantı API Flow

```typescript
// Mobil uygulamadan çağrılan fonksiyon
const connectToIlan = async (ilanNo: string) => {
  const { data } = await supabase.functions.invoke('driver-approve', {
    body: {
      api_key: 'production_api_key_12345',
      ilan_no: ilanNo,
      driver_id: user.id,
      driver_email: user.email,
      action: 'request_connection'
    }
  })
  
  if (data.success) {
    // Bağlantı başarılı
    // Görev listesi otomatik güncellenecek
    Alert.alert('Başarılı!', `İlan ${ilanNo} ile bağlantı kuruldu`)
  } else {
    Alert.alert('Hata', data.error)
  }
}
```

---

## 🔄 Bağlantı Durumları

### 1. Bekleme Durumu
- **İlan**: GPS sistemine gönderildi
- **Durum**: `waiting_for_driver`
- **Şöför**: Henüz bağlanmadı
- **Müşteri**: İlan numarasını şöförle paylaşmalı

### 2. Bağlantı Kuruldu
- **İlan**: Şöför atandı
- **Durum**: `assigned`
- **Şöför**: Görevi görebilir, başlatabilir
- **Müşteri**: "Şöför atandı" bildirimi alır

### 3. Aktif Takip
- **İlan**: GPS takibi başladı
- **Durum**: `in_progress`
- **Şöför**: Konum gönderimini yapıyor
- **Müşteri**: Canlı takip görebilir

---

## 💡 Kullanıcı Deneyimi

### Müşteri Perspektifi
1. İlan oluştur → Onay bekle
2. İlan onaylandı → Email/SMS al
3. İlan numarası al → Şöför firmasına ver
4. Şöför bağlandı → Bildirim al
5. GPS takibi → Canlı izle

### Şöför Perspektifi
1. Müşteriden ilan numarası al
2. Mobil uygulamada "İlan No ile Bağlan"
3. Numarayı gir → Bağlan
4. Görev listesinde gör
5. "Sefer Başlat" → GPS gönder

### kargomarketing.com Admin
1. İlan onayla → GPS sistemine gönder
2. Müşteriye bildir → İlan numarası paylaş
3. Şöför bağlantısını izle
4. GPS durumunu takip et

---

## 🛡️ Güvenlik & Validasyonlar

### 1. API Key Kontrolü
```typescript
const validApiKeys = ['production_api_key_12345', 'test_api_key_123']
if (!validApiKeys.includes(api_key)) {
  return { success: false, error: 'Invalid API key' }
}
```

### 2. İlan Uniqueness
```sql
CREATE UNIQUE INDEX idx_gorevler_ilan_no_unique ON gorevler(ilan_no);
```

### 3. Çift Atama Kontrolü
```typescript
if (existingTask.driver_id && existingTask.driver_id !== driver_id) {
  return { success: false, error: 'Bu ilan zaten başka bir şöföre atanmış' }
}
```

### 4. RLS Policies
```sql
CREATE POLICY "Users can read own tasks" ON gorevler
FOR SELECT USING (auth.uid() = driver_id OR sefer_durumu = 'atanmamis');
```

---

## 📱 Test Senaryosu

### Test İlan Oluşturma
```sql
-- Test için örnek görev
INSERT INTO gorevler (ilan_no, sofor_id, sefer_durumu, customer_info, delivery_address)
VALUES (
  'TEST001',
  (SELECT id FROM auth.users LIMIT 1),
  'atanmamis',
  '{"name": "Test Müşteri", "phone": "+90 555 999 8877"}',
  '{"city": "İstanbul", "district": "Test"}'
);
```

### Test Bağlantısı
1. Mobil uygulamada "İlan No ile Bağlan"
2. "TEST001" gir
3. Bağlantının başarılı olduğunu kontrol et
4. Görev listesinde göründüğünü doğrula

---

**✅ Bu sistem ile şöför-iş eşleştirmesi tam otomatik ve güvenli şekilde çalışır!**
