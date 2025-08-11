# 🚛 GPS Sefer Takip Sistemi - kargomarketing.com Entegrasyon Rehberi

## 📋 Proje Özeti

**GPS Sefer Takip Sistemi**, kargomarketing.com sitesi için geliştirilmiş bir **mobil GPS tracking ve şoför yönetim sistemi**dir. Bu sistem, mevcut kargomarketing.com iş akışına entegre olacak şekilde **dual-Supabase mimarisi** ile tasarlanmıştır.

**CRITICAL UPDATE**: kargomarketing.com also uses Supabase (different project), not PHP/Laravel.

## 🏗️ Sistem Mimarisi ve kargomarketing.com'un Rolü

### Backend Görev Dağılımı

```text
┌─────────────────────────────────────────────────────────────────┐
│              DUAL SUPABASE ENTEGRASYON ARCHITECTURE            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐         ┌──────────────────────────┐   │
│  │   SUPABASE #1       │  Edge   │      SUPABASE #2         │   │
│  │ (kargomarketing.com)│Functions│    (GPS System)          │   │
│  │                     │◄────────┤                          │   │
│  │ ✅ İlan Yönetimi    │         │ 🎯 GPS Tracking          │   │
│  │ ✅ Müşteri DB       │         │ 🎯 Şoför Yönetimi        │   │
│  │ ✅ Teklif Sistemi   │         │ 🎯 Mobil App Data        │   │
│  │ ✅ Ödeme/Fatura     │         │ 🎯 Konum Verileri        │   │
│  │ ✅ Raporlama        │         │ 🎯 Sefer Takibi         │   │
│  └─────────────────────┘         └──────────────────────────┘   │
│           │                                   ▲                 │
│           │ ilan_no (Primary Key)            │                 │
│           ▼                                  │                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │       SUPABASE EDGE FUNCTIONS (Both Projects)          │   │
│  │          (API Gateway / Mikroservis)                   │   │
│  │                                                         │   │
│  │ create-job  │ assign-driver │ get-tracking │ driver-approve │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                 │
│                              │                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           MOBILE APP (React Native/Expo)               │   │
│  │                                                         │   │
│  │ • Şoför Authentication    • GPS Auto-Tracking          │   │
│  │ • Görev Listesi           • Konum Gönderimi             │   │
│  │ • Onay/Red İşlemleri      • Sefer Durumu Updates       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 kargomarketing.com Supabase'de Gerekli Entegrasyon Noktaları

### 1. İş Akışı Entegrasyonu

#### Mevcut İş Akışı:
```
İlan Oluştur → Teklif Al → Teklif Onayla → Manuel Takip
```

#### Yeni GPS Entegreli İş Akışı:
```
İlan Oluştur → Teklif Al → Teklif Onayla → 🔥 GPS Görev Oluştur → Şoför Ata → GPS Takip
```

### 2. Frontend Değişiklikleri (kargomarketing.com)

#### A. İlan Detay Sayfası Güncellemeleri
```php
// İlan detay sayfasında yeni butonlar ve durumlar
<div class="ilan-actions">
    <?php if($ilan->status == 'onaylandi' && !$ilan->gps_job_created): ?>
        <button onclick="createGPSJob(<?= $ilan->id ?>)" class="btn btn-success">
            📍 GPS Takibe Başla
        </button>
    <?php endif; ?>
    
    <?php if($ilan->gps_job_created): ?>
        <div class="gps-status">
            <span class="badge badge-<?= $gps_status_color ?>">
                GPS Durum: <?= $gps_status_text ?>
            </span>
            <button onclick="openGPSTracking('<?= $ilan->ilan_no ?>')" class="btn btn-info">
                🗺️ Canlı Takip
            </button>
        </div>
    <?php endif; ?>
</div>
```

#### B. Yeni GPS Tracking Widget
```php
<!-- İlan sayfasında GPS tracking widget -->
<div id="gps-tracking-widget" class="mt-3" style="display: none;">
    <div class="card">
        <div class="card-header">
            <h5>📍 Canlı GPS Takip - İlan: <span id="tracking-ilan-no"></span></h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-8">
                    <div id="gps-map" style="height: 300px;"></div>
                </div>
                <div class="col-md-4">
                    <div class="gps-info">
                        <p><strong>Şoför:</strong> <span id="driver-name">-</span></p>
                        <p><strong>Durum:</strong> <span id="trip-status">-</span></p>
                        <p><strong>Son Konum:</strong> <span id="last-location">-</span></p>
                        <p><strong>Son Güncelleme:</strong> <span id="last-update">-</span></p>
                        <p><strong>Toplam Mesafe:</strong> <span id="total-distance">-</span></p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
```

#### C. Admin Panel Şoför Atama
```php
// Admin panelde yeni "GPS Yönetimi" sekmesi
<div class="tab-pane" id="gps-management">
    <h4>GPS Görev Yönetimi</h4>
    <table class="table">
        <thead>
            <tr>
                <th>İlan No</th>
                <th>Müşteri</th>
                <th>Durum</th>
                <th>Atanan Şoför</th>
                <th>İşlemler</th>
            </tr>
        </thead>
        <tbody id="gps-jobs-table">
            <!-- AJAX ile doldurulacak -->
        </tbody>
    </table>
</div>
```

### 3. Backend API Implementasyonu (kargomarketing.com)

#### A. GPS Görev Oluşturma Endpoint'i
```php
<?php
// /api/gps/create-job.php

class GPSJobController {
    
    private $supabaseConfig = [
        'base_url' => 'https://iawqwfbvbigtbvipddao.supabase.co/functions/v1',
        'api_key' => 'production_api_key_12345', // .env'den gelecek
    ];
    
    /**
     * İlan onaylandığında otomatik GPS görev oluştur
     */
    public function createGPSJob($ilan_id) {
        try {
            // İlan bilgilerini kargomarketing DB'den çek
            $ilan = $this->getIlanById($ilan_id);
            
            if (!$ilan || $ilan->status !== 'onaylandi') {
                throw new Exception('İlan bulunamadı veya onaylanmamış');
            }
            
            // Supabase Edge Function'a istek gönder
            $endpoint = $this->supabaseConfig['base_url'] . '/create-job';
            
            $payload = [
                'api_key' => $this->supabaseConfig['api_key'],
                'ilan_no' => $ilan->ilan_no,
                'customer_info' => [
                    'name' => $ilan->musteri_adi,
                    'phone' => $ilan->musteri_telefon,
                    'email' => $ilan->musteri_email,
                    'company' => $ilan->musteri_firma
                ],
                'delivery_address' => [
                    'city' => $ilan->varis_sehir,
                    'district' => $ilan->varis_ilce,
                    'full_address' => $ilan->varis_adres,
                    'coordinates' => $ilan->varis_koordinat
                ],
                'priority' => $ilan->oncelik ?? 'normal',
                'deadline' => $ilan->teslimat_tarihi,
                'cargo_type' => $ilan->yuk_tipi,
                'cargo_owner' => $ilan->yuk_sahibi
            ];
            
            $response = $this->httpClient->post($endpoint, $payload);
            
            if ($response['success']) {
                // kargomarketing DB'de GPS job oluşturuldu olarak işaretle
                $this->markGPSJobCreated($ilan_id, $response['job_id']);
                
                return [
                    'success' => true,
                    'message' => 'GPS görevi başarıyla oluşturuldu',
                    'gps_job_id' => $response['job_id']
                ];
            } else {
                throw new Exception($response['error']);
            }
            
        } catch (Exception $e) {
            error_log("GPS Job Creation Error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * GPS tracking verilerini çek
     */
    public function getGPSTracking($ilan_no) {
        try {
            $endpoint = $this->supabaseConfig['base_url'] . '/get-tracking';
            
            $payload = [
                'api_key' => $this->supabaseConfig['api_key'],
                'ilan_no' => $ilan_no
            ];
            
            $response = $this->httpClient->post($endpoint, $payload);
            
            if ($response['success']) {
                return [
                    'success' => true,
                    'tracking_data' => $response['tracking_data'],
                    'status' => $response['status']
                ];
            } else {
                throw new Exception($response['error']);
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}
```

#### B. Webhook Handler'lar
```php
<?php
// /webhook/gps-events.php

class GPSWebhookHandler {
    
    /**
     * Şoför atandığında webhook
     */
    public function handleDriverAssigned($webhook_data) {
        $ilan_no = $webhook_data['ilan_no'];
        $driver_id = $webhook_data['driver_id'];
        $job_id = $webhook_data['job_id'];
        
        // kargomarketing DB'de durumu güncelle
        $this->updateIlanStatus($ilan_no, 'driver_assigned', [
            'gps_driver_id' => $driver_id,
            'gps_job_id' => $job_id
        ]);
        
        // Müşteriye bildirim gönder
        $this->sendCustomerNotification($ilan_no, 'Şoför atandı, kargo takibe alındı');
        
        return ['status' => 'ok'];
    }
    
    /**
     * Sefer başladığında webhook
     */
    public function handleTripStarted($webhook_data) {
        $ilan_no = $webhook_data['ilan_no'];
        
        $this->updateIlanStatus($ilan_no, 'trip_started');
        $this->sendCustomerNotification($ilan_no, 'Kargonuz yola çıktı, canlı takip yapabilirsiniz');
        
        return ['status' => 'ok'];
    }
    
    /**
     * Sefer tamamlandığında webhook
     */
    public function handleTripCompleted($webhook_data) {
        $ilan_no = $webhook_data['ilan_no'];
        
        $this->updateIlanStatus($ilan_no, 'delivered');
        $this->sendCustomerNotification($ilan_no, 'Kargonuz başarıyla teslim edildi');
        
        return ['status' => 'ok'];
    }
}

// Route definitions
$app->post('/webhook/gps/driver-assigned', [GPSWebhookHandler::class, 'handleDriverAssigned']);
$app->post('/webhook/gps/trip-started', [GPSWebhookHandler::class, 'handleTripStarted']);
$app->post('/webhook/gps/trip-completed', [GPSWebhookHandler::class, 'handleTripCompleted']);
```

### 4. Database Değişiklikleri (kargomarketing.com)

#### A. İlanlar Tablosu Güncellemeleri
```sql
-- kargomarketing.com veritabanında yapılacak değişiklikler
ALTER TABLE ilanlar ADD COLUMN gps_job_created BOOLEAN DEFAULT FALSE;
ALTER TABLE ilanlar ADD COLUMN gps_job_id INT NULL;
ALTER TABLE ilanlar ADD COLUMN gps_driver_id VARCHAR(255) NULL;
ALTER TABLE ilanlar ADD COLUMN gps_status ENUM(
    'waiting', 'driver_assigned', 'trip_started', 'in_transit', 'delivered', 'cancelled'
) DEFAULT 'waiting';
ALTER TABLE ilanlar ADD COLUMN gps_last_update TIMESTAMP NULL;

-- Index'ler
CREATE INDEX idx_ilanlar_gps_status ON ilanlar(gps_status);
CREATE INDEX idx_ilanlar_ilan_no ON ilanlar(ilan_no);
```

#### B. GPS Logs Tablosu (isteğe bağlı)
```sql
-- GPS işlemlerini loglama için
CREATE TABLE gps_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ilan_no VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ilan_no (ilan_no),
    INDEX idx_event_type (event_type)
);
```

### 5. JavaScript Frontend Kodu

#### A. GPS İşlemleri
```javascript
// public/js/gps-integration.js

class GPSIntegration {
    
    constructor() {
        this.baseUrl = '/api/gps';
        this.trackingInterval = null;
    }
    
    /**
     * GPS görev oluştur
     */
    async createGPSJob(ilanId) {
        try {
            const response = await fetch(`${this.baseUrl}/create-job`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({ ilan_id: ilanId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('GPS görevi başarıyla oluşturuldu!');
                location.reload(); // Sayfayı yenile
            } else {
                this.showError(data.error);
            }
            
        } catch (error) {
            this.showError('Bir hata oluştu: ' + error.message);
        }
    }
    
    /**
     * Canlı GPS takip başlat
     */
    async startGPSTracking(ilanNo) {
        const widget = document.getElementById('gps-tracking-widget');
        widget.style.display = 'block';
        
        document.getElementById('tracking-ilan-no').textContent = ilanNo;
        
        // İlk veriyi çek
        await this.updateGPSData(ilanNo);
        
        // 30 saniyede bir güncelle
        this.trackingInterval = setInterval(() => {
            this.updateGPSData(ilanNo);
        }, 30000);
    }
    
    /**
     * GPS verilerini güncelle
     */
    async updateGPSData(ilanNo) {
        try {
            const response = await fetch(`${this.baseUrl}/tracking/${ilanNo}`);
            const data = await response.json();
            
            if (data.success) {
                this.updateTrackingWidget(data.tracking_data);
                this.updateMap(data.tracking_data);
            }
            
        } catch (error) {
            console.error('GPS tracking error:', error);
        }
    }
    
    /**
     * Tracking widget'ını güncelle
     */
    updateTrackingWidget(trackingData) {
        const lastLocation = trackingData.last_location;
        
        if (lastLocation) {
            document.getElementById('last-location').textContent = 
                `${lastLocation.lat.toFixed(6)}, ${lastLocation.lon.toFixed(6)}`;
            document.getElementById('last-update').textContent = 
                new Date(lastLocation.timestamp).toLocaleString('tr-TR');
        }
        
        document.getElementById('total-distance').textContent = 
            `${trackingData.total_points} nokta`;
    }
    
    /**
     * Haritayı güncelle (Google Maps veya alternatif)
     */
    updateMap(trackingData) {
        // Google Maps entegrasyonu
        if (trackingData.last_location && window.gpsMap) {
            const position = {
                lat: trackingData.last_location.lat,
                lng: trackingData.last_location.lon
            };
            
            // Marker'ı güncelle
            if (window.gpsMarker) {
                window.gpsMarker.setPosition(position);
            } else {
                window.gpsMarker = new google.maps.Marker({
                    position: position,
                    map: window.gpsMap,
                    title: 'Şoför Konumu',
                    icon: '/images/truck-icon.png'
                });
            }
            
            // Haritayı ortala
            window.gpsMap.setCenter(position);
            
            // Rota çiz (eğer geçmiş konumlar varsa)
            if (trackingData.location_history && trackingData.location_history.length > 1) {
                this.drawRoute(trackingData.location_history);
            }
        }
    }
    
    showSuccess(message) {
        // Bootstrap toast veya alert göster
        alert('Başarılı: ' + message);
    }
    
    showError(message) {
        // Hata mesajı göster
        alert('Hata: ' + message);
    }
}

// Global instance
window.gpsIntegration = new GPSIntegration();

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    // Google Maps'i yükle (eğer GPS widget varsa)
    if (document.getElementById('gps-tracking-widget')) {
        window.initGoogleMaps = function() {
            window.gpsMap = new google.maps.Map(document.getElementById('gps-map'), {
                zoom: 12,
                center: { lat: 41.0082, lng: 28.9784 } // İstanbul merkez
            });
        };
        
        // Google Maps API'yi dinamik yükle
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initGoogleMaps`;
        document.head.appendChild(script);
    }
});
```

### 6. Çevre Değişkenleri (Environment Variables)

#### .env dosyası güncellemeleri
```env
# GPS Sistemi için yeni değişkenler
GPS_SUPABASE_BASE_URL=https://iawqwfbvbigtbvipddao.supabase.co/functions/v1
GPS_API_KEY=production_api_key_12345
GPS_WEBHOOK_SECRET=webhook_secret_key_12345

# Google Maps (opsiyonel)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Bildirim ayarları
GPS_NOTIFICATIONS_ENABLED=true
GPS_EMAIL_NOTIFICATIONS=true
GPS_SMS_NOTIFICATIONS=true
```

## 🎯 Integration Checklist (kargomarketing.com için)

### Phase 1: Backend API Integration
- [ ] **GPSJobController** class'ını implement et
- [ ] **create-job endpoint** oluştur (`/api/gps/create-job`)
- [ ] **get-tracking endpoint** oluştur (`/api/gps/tracking/{ilan_no}`)
- [ ] **Webhook handlers** implement et (`/webhook/gps/*`)
- [ ] **Database migrations** çalıştır (ilanlar tablosu güncellemeleri)
- [ ] **Environment variables** ayarla (GPS API keys)

### Phase 2: Frontend Integration
- [ ] **İlan detay sayfasına** GPS butonları ekle
- [ ] **GPS tracking widget** oluştur
- [ ] **Admin panel GPS yönetimi** sekmesi ekle
- [ ] **JavaScript GPS class** implement et
- [ ] **Google Maps entegrasyonu** (opsiyonel)

### Phase 3: Testing & Deployment
- [ ] **API endpoints test** et (Postman/curl)
- [ ] **Frontend işlevsellik test** et
- [ ] **Webhook delivery test** et
- [ ] **Production deploy** (staging → production)
- [ ] **Error monitoring** setup (logs, alerts)

## 🔧 Teknik Gereksinimler

### Server Requirements
- **PHP 8.0+** (mevcut kargomarketing.com uyumlu)
- **MySQL 8.0+** (JSON column support)
- **cURL extension** (API calls için)
- **HTTPS support** (webhook security)

### Dependencies
```json
{
  "guzzlehttp/guzzle": "^7.0",  // HTTP client
  "vlucas/phpdotenv": "^5.0",   // Environment variables
  "monolog/monolog": "^3.0"     // Logging
}
```

## 📞 Support ve Troubleshooting

### Debug Modları
```php
// config/gps.php
return [
    'debug_mode' => env('GPS_DEBUG', false),
    'log_level' => env('GPS_LOG_LEVEL', 'info'),
    'test_mode' => env('GPS_TEST_MODE', false), // Test API'leri kullan
];
```

### Common Issues
1. **API Authentication Error**: GPS_API_KEY doğruluğunu kontrol et
2. **Webhook Not Received**: Firewall/security ayarlarını kontrol et
3. **CORS Errors**: Frontend domain whitelist'e ekle
4. **Database Connection**: MySQL JSON column support kontrolü

### Monitoring
```php
// GPS işlemlerini logla
Log::channel('gps')->info('GPS job created', [
    'ilan_no' => $ilan_no,
    'gps_job_id' => $gps_job_id,
    'response_time' => $response_time
]);
```

---

## 📝 Özet: kargomarketing.com Yapay Zekası İçin

**Bu GPS sistemi, mevcut kargomarketing.com iş akışına minimum müdahale ile entegre olacak şekilde tasarlanmıştır.**

### Ana Entegrasyon Noktaları:
1. **İlan onayı sonrası** → GPS görev otomatik oluşturma
2. **İlan detay sayfasında** → Canlı GPS takip widget'ı
3. **Admin panelde** → Şoför atama ve GPS yönetimi
4. **Webhook sistemle** → Otomatik durum güncellemeleri

### Avantajlar:
- 🔄 **Mevcut sistem korunur** (no breaking changes)
- 📈 **Müşteri deneyimi artışı** (canlı takip)
- ⚡ **Otomatik süreç** (manuel takip gerekmiyor)
- 🛡️ **Güvenli entegrasyon** (API key authentication)

### Implementation Sırası:
1. **Backend API'ler** (2-3 gün)
2. **Frontend widgets** (2-3 gün)  
3. **Testing & deployment** (1-2 gün)

**Bu bilgilerle kargomarketing.com yapay zekası, GPS sistemi entegrasyonunu sorunsuz bir şekilde implement edebilir.**
