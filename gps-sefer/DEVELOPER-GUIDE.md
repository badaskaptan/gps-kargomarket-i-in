# 🚛 GPS Sefer Takip Sistemi - Kapsamlı Geliştirici Rehberi

## 📋 İçindekiler
1. [Proje Genel Bakış](#proje-genel-bakış)
2. [Sistem Mimarisi](#sistem-mimarisi)
3. [Backend Entegrasyonu](#backend-entegrasyonu)
4. [Teknik Altyapı](#teknik-altyapı)
5. [Kurulum ve Yapılandırma](#kurulum-ve-yapılandırma)
6. [API Dokümantasyonu](#api-dokümantasyonu)
7. [Mobil Uygulama](#mobil-uygulama)
8. [Deployment Rehberi](#deployment-rehberi)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Proje Genel Bakış

### Program Nedir?
**GPS Sefer Takip Sistemi**, şoförlerin araç takip ve sefer yönetimini sağlayan React Native tabanlı bir mobil uygulamadır. Sistem, **dual-Supabase mimarisi** ile çalışır ve gerçek zamanlı konum takibi, görev yönetimi ve backend entegrasyonu sağlar.

**CRITICAL UPDATE**: Both backends are Supabase-based projects, not PHP/Laravel as initially assumed.

### Amaç
- **Şoför Perspektifi**: Mobil uygulamada görevleri görme, onaylama/reddetme, GPS takibi yapma
- **Admin Perspektifi**: Şoför atama, görev durumu takibi, rota analizi
- **Müşteri Perspektifi**: Kargo durumu ve konum takibi
- **Sistem Entegrasyonu**: Mevcut kargo yönetim sistemi (kargomarketing.com Supabase) ile entegrasyon

### Hedef Kullanıcılar
- 🚛 **Şoförler**: GPS takibi, görev onayı, sefer yönetimi
- 👨‍💼 **Dispatch/Admin**: Şoför atama, rota planlama, takip
- 📦 **Müşteriler**: Kargo durumu sorgulama
- 🏢 **Sistem Entegratörü**: API üzerinden otomatik görev aktarımı

---

## 🏗️ Sistem Mimarisi

### Dual Supabase Backend Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│              DUAL SUPABASE BACKEND ARCHITECTURE                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐         ┌──────────────────────────┐   │
│  │   SUPABASE #1       │  Edge   │      SUPABASE #2         │   │
│  │ (kargomarketing.com)│Functions│    (GPS System)          │   │
│  │                     │◄────────┤                          │   │
│  │ • İlan Yönetimi     │         │ • GPS Tracking           │   │
│  │ • Müşteri Bilgileri │         │ • Şoför Yönetimi         │   │
│  │ • Teklif Sistemi    │         │ • Sefer Takibi          │   │
│  │ • Kargo Detayları   │         │ • Mobil App Backend     │   │
│  └─────────────────────┘         └──────────────────────────┘   │
│           │                                   ▲                 │
│           │ ilan_no                          │                 │
│           │ (Primary Key)                    │                 │
│           ▼                                  │                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              EDGE FUNCTIONS (API Gateway)              │   │
│  │                                                         │   │
│  │ create-job  │ assign-driver │ get-tracking │ driver-approve │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                 │
│                              │                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                MOBILE APP (React Native)               │   │
│  │                                                         │   │
│  │ • GPS Tracking     • Task Management                   │   │
│  │ • Authentication   • Real-time Updates                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Sorumluluklar Dağılımı

#### Supabase #1 (kargomarketing.com)

- ✅ **İlan Yönetimi**: Kargo ilanları, teklifler, fiyatlandırma
- ✅ **Müşteri İlişkileri**: Müşteri bilgileri, sipariş yönetimi
- ✅ **İş Süreci Yönetimi**: Teklif onayı, ödeme, faturalandırma
- ✅ **Raporlama**: İş analizi, gelir takibi

#### Supabase #2 (GPS System)

- 🎯 **GPS Tracking**: Gerçek zamanlı konum takibi
- 🎯 **Şoför Yönetimi**: Şoför profilleri, yetkilendirme
- 🎯 **Sefer Takibi**: Seyahat başlangıç/bitiş, duraklar
- 🎯 **Mobil App Data**: Uygulama için özelleştirilmiş veri

### Bağlantı Noktası: ilan_no

- **Primary Key**: İki Supabase project arasındaki tek bağlantı noktası
- **Unique Constraint**: Her ilan numarası benzersiz
- **Data Sync**: Supabase #1'den Supabase #2'ye Edge Function calls ile veri aktarımı

---

## 🔗 Backend Entegrasyonu

### 1. Supabase-to-Supabase Integration

**CRITICAL**: Both systems use Supabase, not PHP. All communication via Edge Functions.

#### İş Akışı

```text
1. İlan Oluşturma (kargomarketing.com Supabase)
   ↓
2. Teklif Süreci & Onay
   ↓
3. Edge Function Call → GPS Supabase System
   ↓
4. GPS Backend'de Görev Oluşturma
   ↓
5. Şoför Atama (Admin Panel)
   ↓
6. Mobil App'de Görev Görüntüleme
   ↓
7. GPS Tracking Başlangıç
```

#### API Integration Points

**Outgoing (kargomarketing.com Supabase → GPS Supabase):**

```typescript
// create-gps-job.ts Edge Function (kargomarketing.com Supabase)
const gpsResponse = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: "production_api_key_12345",
    ilan_no: "KRG2025001",
    customer_info: {
      name: "ABC Lojistik",
      phone: "+90 555 123 4567",
      email: "contact@abc.com"
    },
    delivery_address: {
      city: "İstanbul",
      district: "Kadıköy", 
      full_address: "... detaylı adres ..."
    },
    priority: "urgent",
    cargo_type: "electronics",
    deadline: "2025-08-15T18:00:00Z"
  })
})
```

**Incoming (GPS Supabase → kargomarketing.com Supabase):**

```typescript
// webhook-handler.ts Edge Function (kargomarketing.com Supabase)
// Endpoints: driver-assigned, trip-started, trip-completed, location-update
serve(async (req: Request) => {
  const webhookData = await req.json()
  
  const supabaseKargo = createClient(
    Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
    Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
  )
  
  await supabaseKargo.from('ilanlar').update({
    gps_status: webhookData.type,
    driver_name: webhookData.driver_name,
    gps_last_update: new Date().toISOString()
  }).eq('ilan_no', webhookData.ilan_no)
})
```

### 2. Supabase GPS Backend

#### Database Schema
```sql
-- Temel tablolar
gorevler          -- İş emirleri/görevler
soforler          -- Şoför bilgileri  
konum_gecmisi     -- GPS tracking data
sefer_detaylari   -- Seyahat detayları

-- Yeni entegrasyon kolonları
priority          -- normal/urgent/critical
deadline          -- Son teslim tarihi
cargo_type        -- Kargo tipi
cargo_owner       -- Kargo sahibi
customer_info     -- Müşteri JSON bilgileri
delivery_address  -- Teslimat adresi JSON
driver_approved   -- Şoför onay durumu
driver_notes      -- Şoför notları
```

---

## 💻 Teknik Altyapı

### Frontend Stack
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **State Management**: React Hooks + Context
- **Navigation**: React Navigation v6
- **Location**: Expo Location API
- **HTTP Client**: Fetch API
- **Authentication**: Supabase Auth

### Backend Stack (Supabase)
- **Database**: PostgreSQL + PostGIS
- **Real-time**: Supabase Realtime
- **Authentication**: Supabase Auth (RLS)
- **Edge Functions**: Deno Runtime
- **File Storage**: Supabase Storage (future)

### API Architecture
- **RESTful**: Edge Functions as API Gateway
- **WebHooks**: Event-driven communication
- **CORS**: Cross-origin resource sharing enabled
- **Rate Limiting**: Built-in Supabase protection

### Security
```typescript
// Row Level Security (RLS) Policies
CREATE POLICY "soforler_own_data" 
ON gorevler FOR ALL 
USING (auth.uid() = sofor_id);

CREATE POLICY "admin_full_access" 
ON gorevler FOR ALL 
USING (auth.role() = 'admin');
```

---

## ⚙️ Kurulum ve Yapılandırma

### 1. React Native Mobil App

#### Prerequisites
```bash
# Node.js 18+ gerekli
node --version  # v18.0.0+

# Expo CLI global kurulum
npm install -g @expo/cli

# Git clone
git clone <repository>
cd gps-sefer
```

#### Dependencies Installation
```bash
# Ana dependencies
npm install

# React Navigation
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context

# Platform specific
npx expo install expo-location expo-constants

# Supabase client
npm install @supabase/supabase-js
```

#### Environment Configuration
```typescript
// config/supabase.ts
export const supabaseConfig = {
  url: 'https://iawqwfbvbigtbvipddao.supabase.co',
  anonKey: 'your_anon_key_here',
  apiKey: 'your_service_role_key_here'
}
```

### 2. Supabase Backend Setup

#### Database Initialization
```bash
# SQL files to run in order:
1. supabase-setup.sql          # Base schema
2. backend-integration-update.sql  # Integration columns
```

#### Edge Functions Deployment

**Manual Deployment (Supabase Dashboard):**
1. Project → Edge Functions → "Deploy new function"
2. Function isimleri:
   - `create-job`
   - `assign-driver` 
   - `get-tracking`
   - `driver-approve`

**Environment Variables:**
```env
BACKEND_1_API_KEY=production_api_key_here
BACKEND_1_WEBHOOK_URL=https://kargomarketing.com/api/webhook
SUPABASE_URL=https://iawqwfbvbigtbvipddao.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Integration with kargomarketing.com

#### Required Endpoints (kargomarketing.com side)
```php
// POST /api/gps/create-job
// İlan onaylandığında otomatik çağrılacak
function createGPSJob($ilan_data) {
    $endpoint = 'https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job';
    $data = [
        'api_key' => 'production_api_key',
        'ilan_no' => $ilan_data['ilan_no'],
        'customer_info' => $ilan_data['customer'],
        'delivery_address' => $ilan_data['address'],
        'priority' => $ilan_data['priority'] ?? 'normal'
    ];
    
    return $this->httpClient->post($endpoint, $data);
}

// POST /webhook/driver-assigned
// Şoför atandığında bildirim alacak
function handleDriverAssigned($webhook_data) {
    $ilan_no = $webhook_data['ilan_no'];
    $driver_id = $webhook_data['driver_id'];
    
    // kargomarketing.com veritabanında güncelle
    $this->updateIlanStatus($ilan_no, 'driver_assigned');
}
```

---

## 📚 API Dokümantasyonu

### Edge Functions API

#### 1. create-job
**Purpose**: Backend #1'den yeni görev oluşturma

```typescript
POST /functions/v1/create-job
Content-Type: application/json

Request:
{
  "api_key": "production_api_key",
  "ilan_no": "KRG2025001",
  "customer_info": {
    "name": "Test Müşteri",
    "phone": "+90 555 123 4567"
  },
  "delivery_address": {
    "city": "İstanbul",
    "full_address": "Test Adres"
  },
  "priority": "urgent",
  "cargo_type": "electronics"
}

Response:
{
  "success": true,
  "job_id": 123,
  "ilan_no": "KRG2025001",
  "status": "atanmamis",
  "message": "Job created successfully"
}
```

#### 2. assign-driver
**Purpose**: Admin panelinden şoför atama

```typescript
POST /functions/v1/assign-driver
Content-Type: application/json

Request:
{
  "job_id": 123,
  "driver_id": "user_uuid",
  "admin_user_id": "admin_uuid"
}

Response:
{
  "success": true,
  "job_id": 123,
  "ilan_no": "KRG2025001",
  "driver_id": "user_uuid",
  "status": "atandi"
}
```

#### 3. driver-approve
**Purpose**: Mobil uygulamadan şoför onayı

```typescript
POST /functions/v1/driver-approve
Content-Type: application/json

Request:
{
  "job_id": 123,
  "driver_id": "user_uuid",
  "approve": true,
  "driver_notes": "İsteğe bağlı not"
}

Response:
{
  "success": true,
  "job_id": 123,
  "status": "onaylandi",
  "approved": true
}
```

#### 4. get-tracking
**Purpose**: Backend #1'den GPS verisi çekme

```typescript
POST /functions/v1/get-tracking
Content-Type: application/json

Request:
{
  "ilan_no": "KRG2025001",
  "api_key": "production_api_key"
}

Response:
{
  "success": true,
  "ilan_no": "KRG2025001",
  "status": "devam_ediyor",
  "tracking_data": {
    "last_location": {
      "lat": 40.217,
      "lon": 28.944,
      "timestamp": "2025-08-11T15:30:00Z"
    },
    "location_history": [...],
    "total_points": 25
  }
}
```

### Mobil App APIs

#### Internal RPC Functions
```typescript
// Aktif görevleri getir
const { data } = await supabase.rpc('get_active_gorevler', {
  p_sofor_id: currentUser.id
});

// Konum güncelle  
const { data } = await supabase.rpc('update_konum', {
  p_gorev_id: taskId,
  p_lat: latitude,
  p_lng: longitude
});
```

---

## 📱 Mobil Uygulama

### Ana Özellikler

#### 1. Authentication
```typescript
// Supabase Auth ile giriş
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
};
```

#### 2. GPS Tracking
```typescript
// Konum takibi (5 saniye interval)
const startTracking = async () => {
  const locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000,
      distanceInterval: 10
    },
    (location) => {
      updateLocationInDB(location.coords);
    }
  );
};
```

#### 3. Task Management
```typescript
// Görev onaylama
const approveTask = async (taskId: string, approved: boolean) => {
  const response = await fetch(`${API_BASE}/driver-approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job_id: taskId,
      driver_id: user.id,
      approve: approved
    })
  });
};
```

### Screen Architecture
```
App.tsx
├── AuthScreen.tsx          # Giriş/Kayıt
├── DashboardScreen.tsx     # Ana panel
├── TaskListScreen.tsx      # Görev listesi
├── TaskDetailScreen.tsx    # Görev detayı
├── TrackingScreen.tsx      # GPS takip
└── ProfileScreen.tsx       # Profil ayarları
```

### Navigation Structure
```typescript
// React Navigation v6
const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 🚀 Deployment Rehberi

### 1. Mobil App Deployment

#### Development
```bash
# Expo development server
cd gps-sefer
npx expo start

# Platform specific
npx expo start --android
npx expo start --ios
npx expo start --web
```

#### Production Build
```bash
# EAS Build (recommended)
npm install -g @expo/eas-cli
eas login
eas build --platform android
eas build --platform ios

# Classic build
expo build:android
expo build:ios
```

### 2. Supabase Deployment

#### Edge Functions
```bash
# Supabase CLI (if available)
supabase functions deploy create-job
supabase functions deploy assign-driver
supabase functions deploy get-tracking
supabase functions deploy driver-approve

# Manual deployment via Dashboard
# Project → Edge Functions → Deploy new function
```

#### Database Migrations
```sql
-- Run in Supabase SQL Editor
-- 1. supabase-setup.sql
-- 2. backend-integration-update.sql
-- 3. Any additional migrations
```

### 3. kargomarketing.com Integration

#### API Integration Points
```php
// config/gps_config.php
return [
    'supabase_url' => 'https://iawqwfbvbigtbvipddao.supabase.co',
    'api_key' => env('GPS_API_KEY'),
    'webhook_secret' => env('GPS_WEBHOOK_SECRET'),
    'functions' => [
        'create_job' => '/functions/v1/create-job',
        'get_tracking' => '/functions/v1/get-tracking'
    ]
];
```

#### Webhook Setup
```php
// routes/api.php
Route::post('/webhook/gps/driver-assigned', [GPSController::class, 'driverAssigned']);
Route::post('/webhook/gps/trip-started', [GPSController::class, 'tripStarted']);
Route::post('/webhook/gps/trip-completed', [GPSController::class, 'tripCompleted']);
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Location Permission Errors
```typescript
// Solution: Request permissions properly
const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Location permission needed for GPS tracking');
    return false;
  }
  return true;
};
```

#### 2. Supabase Connection Issues
```typescript
// Solution: Check environment variables
const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('gorevler').select('count');
    if (error) throw error;
    console.log('Supabase connected successfully');
  } catch (error) {
    console.error('Supabase connection failed:', error);
  }
};
```

#### 3. Edge Function Deployment Issues
```bash
# Check function logs
supabase functions logs create-job

# Verify environment variables
# Supabase Dashboard → Settings → API → Environment variables
```

#### 4. Backend Integration Issues
```php
// Debug API calls
$response = $this->httpClient->post($endpoint, $data);
Log::info('GPS API Response:', $response);

// Check webhook delivery
Log::info('Webhook received:', $request->all());
```

### Performance Optimization

#### 1. Location Tracking
```typescript
// Optimize GPS frequency based on speed
const getTrackingInterval = (speed: number) => {
  if (speed > 50) return 3000;  // Highway: 3 seconds
  if (speed > 20) return 5000;  // City: 5 seconds
  return 10000;                 // Slow/stopped: 10 seconds
};
```

#### 2. Database Queries
```sql
-- Add indexes for better performance
CREATE INDEX idx_gorevler_sofor_id ON gorevler(sofor_id);
CREATE INDEX idx_gorevler_ilan_no ON gorevler(ilan_no);
CREATE INDEX idx_gorevler_created_at ON gorevler(created_at);
```

#### 3. API Rate Limiting
```typescript
// Implement request throttling
const throttledApiCall = throttle(apiCall, 1000); // Max 1 call per second
```

---

## 📞 Support & Maintenance

### Development Team Contacts
- **Backend Developer**: [Backend integration lead]
- **Mobile Developer**: [React Native lead]
- **DevOps**: [Deployment and infrastructure]

### Production Monitoring
- **Supabase Dashboard**: Error logs, performance metrics
- **Expo Application Services**: Build status, crash reports
- **kargomarketing.com Logs**: Integration status, webhook delivery

### Version Control
```bash
# Git workflow
git checkout -b feature/new-functionality
git commit -m "feat: add new tracking feature"
git push origin feature/new-functionality
# Create Pull Request
```

---

## 📝 Changelog

### v1.0.0 (Current)
- ✅ React Native base app with GPS tracking
- ✅ Supabase backend with PostgreSQL + PostGIS
- ✅ Edge Functions for API gateway
- ✅ Backend integration architecture
- ✅ Task management system
- ✅ Real-time location updates

### v1.1.0 (Planned)
- 🔮 Push notifications
- 🔮 Offline mode support
- 🔮 Advanced route optimization
- 🔮 Photo upload for delivery proof
- 🔮 Driver performance analytics

---

## 🎯 Next Steps for Integration

### kargomarketing.com Integration Checklist

#### Phase 1: API Integration
- [ ] İlan onayı sonrası otomatik GPS görev oluşturma
- [ ] Webhook endpoints implement etme
- [ ] API authentication setup
- [ ] Error handling ve logging

#### Phase 2: UI Integration  
- [ ] Admin panel'de GPS tracking widget
- [ ] Müşteri portal'da canlı takip
- [ ] Şoför durumu göstergesi
- [ ] Delivery proof display

#### Phase 3: Advanced Features
- [ ] Route optimization integration
- [ ] Automated ETA calculations
- [ ] Customer notification system
- [ ] Reporting dashboard

---

**Bu rehber, GPS Sefer Takip Sistemi'nin tüm teknik detaylarını ve entegrasyon sürecini kapsamaktadır. Gelecekteki geliştirmeler ve bakım işlemleri için referans doküman olarak kullanılabilir.**
