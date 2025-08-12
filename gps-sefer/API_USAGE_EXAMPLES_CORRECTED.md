# 📞 kargomarketing.com Supabase Integration Quick Reference

## 🎯 Özet: GPS Sistemi Entegrasyonu (SUPABASE-TO-SUPABASE)

**CORRECTED**: kargomarketing.com also uses Supabase (different project), not PHP/Laravel.

### Sistem Özeti

- **Backend #1**: kargomarketing.com Supabase Project
- **Backend #2**: GPS System Supabase Project (`https://iawqwfbvbigtbvipddao.supabase.co`)
- **API Key**: `production_api_key_12345` (production), `test_api_key_123` (test)
- **Entegrasyon Yöntemi**: Supabase Edge Functions + REST API calls

---

## 1️⃣ İlan Onayı → GPS Görev Oluşturma

### kargomarketing.com Edge Function

```typescript
// create-gps-job.ts (kargomarketing.com Supabase)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const { ilan_id } = await req.json()
    
    // kargomarketing.com Supabase bağlantısı
    const supabaseKargo = createClient(
      Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
      Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
    )
    
    // İlan bilgilerini çek
    const { data: ilan, error: ilanError } = await supabaseKargo
      .from('ilanlar')
      .select('*')
      .eq('id', ilan_id)
      .single()
    
    if (ilanError || !ilan || ilan.status !== 'onaylandi') {
      throw new Error('İlan bulunamadı veya onaylanmamış')
    }
    
    // GPS Sistemi'ne API call (Supabase B)
    const gpsResponse = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: Deno.env.get('GPS_API_KEY'), // production_api_key_12345
        ilan_no: ilan.ilan_no,
        customer_info: {
          name: ilan.musteri_adi,
          phone: ilan.musteri_telefon,
          email: ilan.musteri_email
        },
        delivery_address: {
          city: ilan.varis_sehir,
          full_address: ilan.varis_adres
        },
        priority: ilan.oncelik || 'normal',
        cargo_type: ilan.yuk_tipi
      })
    })
    
    const gpsResult = await gpsResponse.json()
    
    if (gpsResult.success) {
      // kargomarketing.com DB'de GPS job oluşturuldu olarak işaretle
      await supabaseKargo
        .from('ilanlar')
        .update({
          gps_job_created: true,
          gps_job_id: gpsResult.job_id,
          gps_status: 'waiting',
          gps_last_update: new Date().toISOString()
        })
        .eq('id', ilan_id)
      
      return new Response(JSON.stringify({
        success: true,
        gps_job_id: gpsResult.job_id,
        message: 'GPS görevi başarıyla oluşturuldu'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      throw new Error(gpsResult.error)
    }
    
  } catch (error) {
    console.error('GPS job creation failed:', error.message)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Kullanım: İlan onaylandığında Edge Function çağır
// supabase.functions.invoke('create-gps-job', { body: { ilan_id: 123 } })
```

---

## 2️⃣ Canlı GPS Verilerini Çekme

### kargomarketing.com tracking Edge Function

```typescript
// get-gps-tracking.ts (kargomarketing.com Supabase)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req: Request) => {
  try {
    const { ilan_no } = await req.json()
    
    // GPS Sistemi'nden tracking verilerini çek
    const gpsResponse = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/get-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: Deno.env.get('GPS_API_KEY'),
        ilan_no: ilan_no
      })
    })
    
    const trackingData = await gpsResponse.json()
    
    if (trackingData.success) {
      return new Response(JSON.stringify({
        success: true,
        status: trackingData.status,
        last_location: trackingData.tracking_data?.last_location,
        location_history: trackingData.tracking_data?.location_history,
        last_update: trackingData.tracking_data?.last_update,
        total_points: trackingData.tracking_data?.total_points
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      throw new Error(trackingData.error)
    }
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

// Frontend'den kullanım:
// const { data } = await supabase.functions.invoke('get-gps-tracking', { 
//   body: { ilan_no: 'KRG2025001' } 
// })
```

---

## 3️⃣ Webhook Listener (GPS'ten gelen güncellemeler)

### kargomarketing.com webhook handler Edge Function

```typescript
// webhook-handler.ts (kargomarketing.com Supabase)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }
    
    const webhookData = await req.json()
    
    // Webhook güvenlik kontrolü
    const receivedApiKey = req.headers.get('x-api-key')
    if (receivedApiKey !== Deno.env.get('GPS_API_KEY')) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    const supabaseKargo = createClient(
      Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
      Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
    )
    
    // Webhook tiplerine göre işlem
    switch (webhookData.type) {
      case 'driver_assigned':
        await supabaseKargo
          .from('ilanlar')
          .update({
            gps_status: 'assigned',
            driver_name: webhookData.driver_name,
            driver_phone: webhookData.driver_phone,
            gps_last_update: new Date().toISOString()
          })
          .eq('ilan_no', webhookData.ilan_no)
        break
        
      case 'trip_started':
        await supabaseKargo
          .from('ilanlar')
          .update({
            gps_status: 'in_progress',
            trip_start_time: webhookData.start_time,
            gps_last_update: new Date().toISOString()
          })
          .eq('ilan_no', webhookData.ilan_no)
        break
        
      case 'location_update':
        // Real-time konum güncelleme
        await supabaseKargo
          .from('ilanlar')
          .update({
            current_lat: webhookData.lat,
            current_lng: webhookData.lng,
            gps_last_update: new Date().toISOString()
          })
          .eq('ilan_no', webhookData.ilan_no)
        break
        
      case 'trip_completed':
        await supabaseKargo
          .from('ilanlar')
          .update({
            gps_status: 'completed',
            trip_end_time: webhookData.end_time,
            gps_last_update: new Date().toISOString()
          })
          .eq('ilan_no', webhookData.ilan_no)
        break
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Webhook processing failed:', error.message)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 4️⃣ React Frontend GPS Widget

### kargomarketing.com GPS tracking widget

```typescript
// GPSTrackingWidget.tsx (kargomarketing.com React component)
import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.REACT_APP_KARGOMARKETING_SUPABASE_URL,
  process.env.REACT_APP_KARGOMARKETING_ANON_KEY
)

interface GPSWidgetProps {
  ilanNo: string
}

export const GPSTrackingWidget: React.FC<GPSWidgetProps> = ({ ilanNo }) => {
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-gps-tracking', {
          body: { ilan_no: ilanNo }
        })
        
        if (error) throw error
        
        if (data.success) {
          setTrackingData(data)
        } else {
          setError(data.error)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchTracking()
    
    // Her 30 saniyede bir güncelle
    const interval = setInterval(fetchTracking, 30000)
    return () => clearInterval(interval)
  }, [ilanNo])

  if (loading) return <div>GPS verileri yükleniyor...</div>
  if (error) return <div>Hata: {error}</div>
  if (!trackingData) return <div>GPS verisi bulunamadı</div>

  return (
    <div className="gps-widget">
      <h3>🚛 Araç Takip</h3>
      <div className="status">
        <strong>Durum:</strong> {trackingData.status}
      </div>
      
      {trackingData.last_location && (
        <div className="location">
          <strong>Son Konum:</strong><br/>
          Lat: {trackingData.last_location.lat}<br/>
          Lng: {trackingData.last_location.lng}<br/>
          <small>Son güncelleme: {trackingData.last_update}</small>
        </div>
      )}
      
      <div className="stats">
        <strong>Toplam Nokta:</strong> {trackingData.total_points}
      </div>
      
      {/* Google Maps entegrasyonu */}
      <div className="map-container">
        <iframe 
          src={`https://maps.google.com/maps?q=${trackingData.last_location?.lat},${trackingData.last_location?.lng}&output=embed`}
          width="100%" 
          height="200"
          style={{ border: 0 }}
        />
      </div>
    </div>
  )
}

// Kullanım:
// <GPSTrackingWidget ilanNo="KRG2025001" />
```

---

## 5️⃣ Database Schema Updates

### kargomarketing.com Supabase veritabanı güncellemesi

```sql
-- İlanlar tablosuna GPS entegrasyonu için kolonlar ekle
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS gps_job_created BOOLEAN DEFAULT false;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS gps_job_id TEXT;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS gps_status TEXT DEFAULT 'waiting';
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10,8);
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS current_lng DECIMAL(11,8);
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS trip_start_time TIMESTAMPTZ;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS trip_end_time TIMESTAMPTZ;
ALTER TABLE ilanlar ADD COLUMN IF NOT EXISTS gps_last_update TIMESTAMPTZ;

-- GPS durumları için enum
CREATE TYPE gps_status_enum AS ENUM ('waiting', 'assigned', 'in_progress', 'completed', 'cancelled');
ALTER TABLE ilanlar ALTER COLUMN gps_status TYPE gps_status_enum USING gps_status::gps_status_enum;
```

---

## 6️⃣ Email & SMS Notifications

### kargomarketing.com notification Edge Function

```typescript
// send-notifications.ts (kargomarketing.com Supabase)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const { ilan_no, notification_type, driver_info } = await req.json()
    
    const supabaseKargo = createClient(
      Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
      Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
    )
    
    // İlan bilgilerini çek
    const { data: ilan } = await supabaseKargo
      .from('ilanlar')
      .select('*')
      .eq('ilan_no', ilan_no)
      .single()
    
    if (!ilan) {
      throw new Error('İlan bulunamadı')
    }
    
    // Email gönder (Resend/SendGrid/etc kullanarak)
    if (ilan.musteri_email) {
      await sendEmail({
        to: ilan.musteri_email,
        subject: getEmailSubject(notification_type),
        template: getEmailTemplate(notification_type),
        data: {
          customer_name: ilan.musteri_adi,
          ilan_no: ilan_no,
          driver_info: driver_info,
          tracking_url: `https://kargomarketing.com/tracking/${ilan_no}`
        }
      })
    }
    
    // SMS gönder (Twilio/Netgsm/etc kullanarak)
    if (ilan.musteri_telefon) {
      await sendSMS({
        to: ilan.musteri_telefon,
        message: getSMSMessage(notification_type, ilan, driver_info)
      })
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function getEmailSubject(type: string): string {
  const subjects = {
    'driver_assigned': '🚛 Şoför Atandı - Takip Bilgileri',
    'trip_started': '📍 Kargonuz Yola Çıktı',
    'trip_completed': '✅ Kargonuz Teslim Edildi'
  }
  return subjects[type] || 'Kargo Güncelleme'
}

function getSMSMessage(type: string, ilan: any, driver_info: any): string {
  const messages = {
    'driver_assigned': `Sayın ${ilan.musteri_adi}, yükünüz için şoför atandı. Şoför: ${driver_info?.name} (${driver_info?.phone}). Takip: kargomarketing.com/tracking/${ilan.ilan_no}`,
    'trip_started': `Kargonuz yola çıktı! Takip: kargomarketing.com/tracking/${ilan.ilan_no}`,
    'trip_completed': `Kargonuz başarıyla teslim edildi. Teşekkürler!`
  }
  return messages[type] || 'Kargo durumu güncellendi'
}
```

---

## 🔧 Test ve Kurulum

### Test API calls

```bash
# Test ortamı için GPS job oluşturma
curl -X POST https://your-kargomarketing-supabase.supabase.co/functions/v1/create-gps-job \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{"ilan_id": 123}'

# GPS tracking testi
curl -X POST https://your-kargomarketing-supabase.supabase.co/functions/v1/get-gps-tracking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{"ilan_no": "KRG2025001"}'
```

### kargomarketing.com yapılacaklar listesi

1. ✅ **Edge Functions oluştur**: create-gps-job.ts, get-gps-tracking.ts, webhook-handler.ts
2. ✅ **Database güncellemesi**: GPS kolonları ekle
3. ⏳ **Frontend widget**: React GPS tracking komponenti
4. ⏳ **Webhook endpoint**: GPS güncellemelerini dinle
5. ⏳ **Test**: API entegrasyonu test et

### Test sürecindekiler

```typescript
// Test için Supabase Edge Function
const testGPSIntegration = async () => {
  const { data } = await supabase.functions.invoke('create-gps-job', {
    body: { ilan_id: 1 }
  })
  console.log('GPS Job Result:', data)
}
```

### Environment Variables (.env)

```bash
# kargomarketing.com Supabase Edge Functions environment
KARGOMARKETING_SUPABASE_URL=https://your-kargomarketing-project.supabase.co
KARGOMARKETING_SERVICE_KEY=your_service_role_key
GPS_API_KEY=production_api_key_12345

# React Frontend environment
REACT_APP_KARGOMARKETING_SUPABASE_URL=https://your-kargomarketing-project.supabase.co
REACT_APP_KARGOMARKETING_ANON_KEY=your_anon_key
```

---

**🎯 Bu dosya kargomarketing.com AI'ına GPS sistemi entegrasyonu için gerekli tüm kodu sağlar. Her örnek doğrudan kullanıma hazır Supabase Edge Function formatındadır.**

**CRITICAL**: kargomarketing.com da Supabase kullandığı için PHP/Laravel yerine TypeScript Edge Functions kullanmalıdır.
