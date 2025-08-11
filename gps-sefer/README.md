# 🚛 GPS Sefer Takip Sistemi

**Şoförlerin araç takip ve sefer yönetimini sağlayan React Native mobil uygulaması**

Bu sistem dual-backend mimarisi ile çalışır: 
- **Backend #1 (kargomarketing.com)**: İlan yönetimi, müşteri ilişkileri
- **Backend #2 (Supabase GPS)**: GPS tracking, şoför yönetimi, mobil app backend

## ✨ Özellikler

### Mobil Uygulama
- 🔐 **Authentication**: Supabase Auth ile güvenli giriş
- 📍 **GPS Tracking**: Arka plan konum takibi (5 saniye interval)
- 🚛 **Görev Yönetimi**: Atanan görevleri görme, onaylama/reddetme
- 🎯 **Otomatik Tespit**: Varış noktasına yakınlık tespiti (50m)
- 🔄 **Realtime**: Canlı güncellemeler ve senkronizasyon
- 📱 **Background**: Uygulama kapalıyken bile konum takibi

### Backend Entegrasyonu
- 🔗 **API Gateway**: Edge Functions ile RESTful API
- 🎪 **Webhook System**: Event-driven komunikasyon
- 🗄️ **Dual Database**: PostgreSQL + PostGIS destekli
- 🛡️ **Security**: RLS policies ve API key authentication

## 🏗️ Sistem Mimarisi

```
kargomarketing.com (Backend #1) ↔ Supabase (Backend #2) ↔ Mobile App
        │                            │                      │
    İlan Yönetimi               GPS Tracking           React Native
    Müşteri Bilgileri           Şoför Yönetimi         Authentication  
    Teklif Sistemi              Edge Functions         Location Services
```

**Bağlantı Noktası**: `ilan_no` (Primary Key)

## 🌉 Bridge API Deployment

Bridge API GPS Backend'inde çalışan Edge Function'dır. Manuel deployment:

### 1. GPS Backend Edge Functions'a Git:
- https://supabase.com/dashboard/project/tbepkrfktjofmhxcpfgo/functions

### 2. "bridge-api" isimli yeni Edge Function oluştur

### 3. Bu kodu kopyala:
```typescript
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Backend1 (Kargomarketing) bağlantısı
const KARGOMARKETING_URL = 'https://rmqwrdeaecjyyalbnvbq.supabase.co'
const KARGOMARKETING_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtcXdyZGVhZWNqeXlhbGJudmJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTgzMzczNSwiZXhwIjoyMDY3NDA5NzM1fQ.rOzqLrzmUs2V1zS5wBHk_t6S8xHt8fJL7bSj9OD9aQI'

const kargomarketing = createClient(KARGOMARKETING_URL, KARGOMARKETING_SERVICE_KEY)

serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const endpoint = url.pathname.split('/').pop()

    switch (endpoint) {
      case 'realtime-gps':
        return await handleRealtimeGPS(req, corsHeaders)
      
      case 'driver-assigned':
        return await handleDriverAssigned(req, corsHeaders)
      
      case 'sync-tasks':
        return await handleSyncTasks(req, corsHeaders)
      
      default:
        return new Response('Endpoint not found', { 
          status: 404, 
          headers: corsHeaders 
        })
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// � Real-time GPS: Backend2 → Backend1 (Anlık, depolama yok)
async function handleRealtimeGPS(req: Request, corsHeaders: any) {
  const { ilan_no, driver_id, location, timestamp, customer_info } = await req.json()

  // Backend1'e anlık GPS gönder (UPDATE, depolama yapma)
  await kargomarketing
    .from('gorevler')
    .update({
      konum_verisi: location,
      updated_at: timestamp
    })
    .eq('ilan_no', ilan_no)
    .eq('sofor_id', driver_id)

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Real-time GPS sent to Backend1' 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// 👨‍💼 Driver Assigned: Şoför atandığında Backend1'i bilgilendir
async function handleDriverAssigned(req: Request, corsHeaders: any) {
  const { ilan_no, driver_id, task_id, status } = await req.json()

  // Backend1'de şoför bilgisini güncelle
  await kargomarketing
    .from('gorevler')
    .update({
      sofor_id: driver_id,
      sefer_durumu: status,
      baslama_zamani: new Date().toISOString()
    })
    .eq('ilan_no', ilan_no)

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Driver assignment synced to Backend1' 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// 🔄 Task Sync: Backend1 → Backend2 (Yeni görevleri senkronize et)
async function handleSyncTasks(req: Request, corsHeaders: any) {
  // Backend1'den yeni görevleri al
  const { data: newTasks } = await kargomarketing
    .from('gorevler')
    .select('*')
    .eq('sefer_durumu', 'atanmamis')
    .is('sofor_id', null)

  // Backend2'ye kopyala
  if (newTasks && newTasks.length > 0) {
    // GPS Backend'ine görev ekleme işlemi buraya
    // (Şu an için manuel ekliyoruz)
  }

  return new Response(JSON.stringify({ 
    success: true, 
    synced_tasks: newTasks?.length || 0 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

### 4. Deploy Et ve URL'yi Not Al:
Bridge API URL: `https://tbepkrfktjofmhxcpfgo.supabase.co/functions/v1/bridge-api`

---

### Prerequisites
```bash
# Node.js 18+ gerekli
node --version  # v18.0.0+

# Expo CLI
npm install -g @expo/cli
```

### Mobil App Setup
```bash
# 1. Projeyi klonla
git clone <repository>
cd gps-sefer

# 2. Dependencies
npm install

# 3. Uygulamayı çalıştır
npx expo start
```

### Backend Setup (Supabase)
1. **Database Schema**: `supabase-setup.sql` çalıştır
2. **Integration Updates**: `backend-integration-update.sql` çalıştır  
3. **Edge Functions**: Manual deployment (detaylar `EDGE-FUNCTIONS-DEPLOYMENT.md`)
4. **Environment Variables**: API keys ve webhook URLs

## 🚀 Deployment

### Edge Functions API Endpoints
```
https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/
├── create-job       # kargomarketing.com → Supabase
├── assign-driver    # Admin panel → Şoför atama
├── get-tracking     # kargomarketing.com ← GPS data
└── driver-approve   # Mobile app → Şoför onayı
```

### Test Panel
`backend1-test-panel.html` dosyasını tarayıcıda aç → API testleri yap

## 📚 Dokümantasyon

- 📋 **[DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md)**: Kapsamlı geliştirici rehberi
- 🚀 **[EDGE-FUNCTIONS-DEPLOYMENT.md](./EDGE-FUNCTIONS-DEPLOYMENT.md)**: Deployment adımları
- 🗄️ **[supabase-setup.sql](./supabase-setup.sql)**: Veritabanı şeması
- 🔗 **[backend-integration-update.sql](./backend-integration-update.sql)**: Entegrasyon güncellemeleri

## 🎯 Kullanım Senaryoları

### 1. İlan Onayından GPS Görevine
```javascript
// kargomarketing.com'da ilan onaylandığında
POST /functions/v1/create-job
{
  "api_key": "production_key",
  "ilan_no": "KRG2025001",
  "customer_info": {...},
  "priority": "urgent"
}
```

### 2. Şoför Atama ve Onay
```javascript
// Admin panelden şoför ata
POST /functions/v1/assign-driver
// Mobil app'de şoför onayla  
POST /functions/v1/driver-approve
```

### 3. GPS Tracking
```javascript
// kargomarketing.com'dan konum sorgula
POST /functions/v1/get-tracking
{
  "ilan_no": "KRG2025001",
  "api_key": "production_key"
}
```

## 💻 Development Commands

```bash
# Development server
npx expo start

# Platform specific  
npx expo start --android
npx expo start --ios
npx expo start --web

# Build
eas build --platform android
eas build --platform ios
```

## 🔧 Environment Variables

### Supabase (Edge Functions)
```env
BACKEND_1_API_KEY=production_api_key
BACKEND_1_WEBHOOK_URL=https://kargomarketing.com/api/webhook
```

### Mobile App
```typescript
// config/supabase.ts
export const supabaseConfig = {
  url: 'https://iawqwfbvbigtbvipddao.supabase.co',
  anonKey: 'your_anon_key'
}
```

## 🐛 Troubleshooting

### Common Issues
- **Location Permission**: iOS/Android konum izinleri
- **Background Tasks**: Platform specific background limitations  
- **API Authentication**: API key validation
- **CORS**: Cross-origin ayarları

### Debug
```bash
# Supabase function logs
supabase functions logs create-job

# Expo development logs
npx expo start --clear
```

## 🤝 Integration Points

### kargomarketing.com Side Implementation
```php
// İlan onayı sonrası otomatik GPS görev oluşturma
function createGPSJob($ilan_data) {
    $endpoint = 'https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job';
    return $this->httpClient->post($endpoint, [
        'api_key' => 'production_key',
        'ilan_no' => $ilan_data['ilan_no'],
        // ... diğer data
    ]);
}

// Webhook endpoints
POST /webhook/gps/driver-assigned
POST /webhook/gps/trip-started  
POST /webhook/gps/trip-completed
```

## 📞 Support

- **Technical Documentation**: `DEVELOPER-GUIDE.md`
- **API Documentation**: Edge Functions bölümü
- **Database Schema**: SQL dosyaları
- **Deployment Guide**: `EDGE-FUNCTIONS-DEPLOYMENT.md`

---

**Bu sistem kargomarketing.com ile tam entegre çalışacak şekilde tasarlanmıştır. Dual-backend mimarisi ile yüksek performans ve ölçeklenebilirlik sağlar.**
5. **Sefer Bitir**: Manuel veya otomatik (50m yakınlık) sefer sonlandırma

## Geliştirme

- TypeScript kullanılmıştır
- Expo managed workflow
- React Navigation 6
- Supabase client
- Background location tracking

## Güvenlik

- RLS (Row Level Security) aktif
- Sadece kendi kayıtlarını görme/güncelleme
- Anon key kullanımı (service_role asla client'ta kullanılmaz)

## Lisans

[MIT](LICENSE)
