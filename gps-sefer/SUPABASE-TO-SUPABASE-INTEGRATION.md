# 🔄 Supabase-to-Supabase Integration Guide - CORRECTED

## ⚠️ IMPORTANT UPDATE: Both Backends are Supabase

**Correction**: kargomarketing.com is also Supabase-based (different project), not PHP/Laravel.

## 🏗️ Corrected Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                SUPABASE-TO-SUPABASE ARCHITECTURE               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐         ┌──────────────────────────┐   │
│  │   BACKEND #1        │  REST   │      BACKEND #2          │   │
│  │ (kargomarketing.com)│  API    │    (GPS System)          │   │
│  │   SUPABASE A        │◄────────┤     SUPABASE B           │   │
│  │                     │         │                          │   │
│  │ ✅ İlan Management  │         │ 🎯 GPS Tracking          │   │
│  │ ✅ Customer DB      │         │ 🎯 Driver Management     │   │
│  │ ✅ Offer System     │         │ 🎯 Mobile App Data       │   │
│  │ ✅ Payment/Invoice  │         │ 🎯 Location Data         │   │
│  └─────────────────────┘         └──────────────────────────┘   │
│           │                                   ▲                 │
│           │ ilan_no (Primary Key)            │                 │
│           ▼                                  │                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SUPABASE B EDGE FUNCTIONS                 │   │
│  │                                                         │   │
│  │ create-job  │ assign-driver │ get-tracking │ driver-approve │
│  └─────────────────────────────────────────────────────────┘   │
│                              ▲                                 │
│                              │                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           MOBILE APP (React Native/Expo)               │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔗 Corrected Integration Methods

### 1. Supabase A → Supabase B (Edge Function Call)

Instead of PHP, kargomarketing.com will use **Edge Functions** to call GPS system:

```typescript
// kargomarketing.com Edge Function: create-gps-job.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const { ilan_id } = await req.json()
    
    // Get ilan data from kargomarketing.com Supabase
    const supabaseA = createClient(
      Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
      Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
    )
    
    const { data: ilan } = await supabaseA
      .from('ilanlar')
      .select('*')
      .eq('id', ilan_id)
      .single()
    
    if (!ilan || ilan.status !== 'onaylandi') {
      throw new Error('İlan not found or not approved')
    }
    
    // Call GPS System (Supabase B)
    const gpsResponse = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: Deno.env.get('GPS_API_KEY'),
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
      // Update kargomarketing.com database
      await supabaseA
        .from('ilanlar')
        .update({
          gps_job_created: true,
          gps_job_id: gpsResult.job_id,
          gps_status: 'waiting'
        })
        .eq('id', ilan_id)
      
      return new Response(JSON.stringify({
        success: true,
        gps_job_id: gpsResult.job_id
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      throw new Error(gpsResult.error)
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
```

### 2. GPS Tracking Data Retrieval

```typescript
// kargomarketing.com Edge Function: get-gps-tracking.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

serve(async (req: Request) => {
  try {
    const { ilan_no } = await req.json()
    
    // Call GPS System
    const response = await fetch('https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/get-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: Deno.env.get('GPS_API_KEY'),
        ilan_no: ilan_no
      })
    })
    
    const trackingData = await response.json()
    
    return new Response(JSON.stringify(trackingData), {
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
```

### 3. Database Updates (PostgreSQL for both)

#### kargomarketing.com Supabase Database Updates:

```sql
-- Add GPS tracking columns to ilanlar table
ALTER TABLE ilanlar 
ADD COLUMN gps_job_created BOOLEAN DEFAULT FALSE,
ADD COLUMN gps_job_id INT NULL,
ADD COLUMN gps_driver_id UUID NULL,
ADD COLUMN gps_status TEXT DEFAULT 'waiting',
ADD COLUMN gps_last_update TIMESTAMP WITH TIME ZONE NULL;

-- Create indexes
CREATE INDEX idx_ilanlar_gps_status ON ilanlar(gps_status);
CREATE INDEX idx_ilanlar_ilan_no ON ilanlar(ilan_no);
CREATE INDEX idx_ilanlar_gps_job_id ON ilanlar(gps_job_id);

-- GPS logs table
CREATE TABLE gps_logs (
    id BIGSERIAL PRIMARY KEY,
    ilan_no TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gps_logs_ilan_no ON gps_logs(ilan_no);
CREATE INDEX idx_gps_logs_event_type ON gps_logs(event_type);
```

### 4. Webhook Handlers (Supabase Edge Functions)

#### Driver Assigned Webhook:

```typescript
// kargomarketing.com Edge Function: webhook-driver-assigned.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const webhookData = await req.json()
    const { ilan_no, driver_id, job_id } = webhookData
    
    // Verify webhook signature (security)
    const signature = req.headers.get('x-webhook-signature')
    if (!verifyWebhookSignature(signature, JSON.stringify(webhookData))) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    // Update kargomarketing.com database
    const supabase = createClient(
      Deno.env.get('KARGOMARKETING_SUPABASE_URL')!,
      Deno.env.get('KARGOMARKETING_SERVICE_KEY')!
    )
    
    await supabase
      .from('ilanlar')
      .update({
        gps_status: 'driver_assigned',
        gps_driver_id: driver_id,
        gps_last_update: new Date().toISOString()
      })
      .eq('ilan_no', ilan_no)
    
    // Send customer notification
    const { data: ilan } = await supabase
      .from('ilanlar')
      .select('musteri_email, musteri_adi')
      .eq('ilan_no', ilan_no)
      .single()
    
    if (ilan?.musteri_email) {
      await sendCustomerEmail(ilan.musteri_email, 'driver_assigned', {
        ilan_no: ilan_no,
        customer_name: ilan.musteri_adi
      })
    }
    
    // Log event
    await supabase
      .from('gps_logs')
      .insert({
        ilan_no: ilan_no,
        event_type: 'driver_assigned',
        event_data: webhookData
      })
    
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

function verifyWebhookSignature(signature: string | null, payload: string): boolean {
  if (!signature) return false
  
  const expectedSignature = crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(Deno.env.get('GPS_WEBHOOK_SECRET') + payload)
  )
  
  return signature === expectedSignature
}
```

### 5. Frontend Integration (React/Next.js)

Since kargomarketing.com is Supabase-based, it likely uses React/Next.js:

```typescript
// kargomarketing.com frontend component
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const GPSTrackingWidget = ({ ilanNo }: { ilanNo: string }) => {
  const [trackingData, setTrackingData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const startGPSTracking = async () => {
    setLoading(true)
    
    try {
      // Call internal Edge Function
      const { data, error } = await supabase.functions.invoke('get-gps-tracking', {
        body: { ilan_no: ilanNo }
      })
      
      if (error) throw error
      
      if (data.success) {
        setTrackingData(data)
        
        // Start auto-refresh
        const interval = setInterval(async () => {
          const { data: newData } = await supabase.functions.invoke('get-gps-tracking', {
            body: { ilan_no: ilanNo }
          })
          if (newData?.success) {
            setTrackingData(newData)
          }
        }, 30000) // 30 seconds
        
        return () => clearInterval(interval)
      }
      
    } catch (error) {
      console.error('GPS tracking error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    startGPSTracking()
  }, [ilanNo])
  
  if (loading) return <div>GPS verileri yükleniyor...</div>
  
  return (
    <div className="gps-tracking-widget">
      <h3>📍 Canlı GPS Takip - {ilanNo}</h3>
      
      {trackingData ? (
        <div className="tracking-info">
          <p><strong>Durum:</strong> {getStatusText(trackingData.status)}</p>
          
          {trackingData.tracking_data?.last_location && (
            <div>
              <p><strong>Son Konum:</strong></p>
              <p>Lat: {trackingData.tracking_data.last_location.lat.toFixed(6)}</p>
              <p>Lon: {trackingData.tracking_data.last_location.lon.toFixed(6)}</p>
              <p><strong>Son Güncelleme:</strong> {
                new Date(trackingData.tracking_data.last_update).toLocaleString('tr-TR')
              }</p>
            </div>
          )}
          
          <div id={`map-${ilanNo}`} style={{ height: '300px', marginTop: '20px' }}>
            {/* Google Maps component here */}
          </div>
        </div>
      ) : (
        <p>GPS verisi bulunamadı</p>
      )}
    </div>
  )
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'atanmamis': 'Şoför Atanmamış',
    'atandi': 'Şoför Atandı',
    'onaylandi': 'Şoför Onayladı',
    'basladi': 'Sefer Başladı',
    'devam_ediyor': 'Devam Ediyor',
    'tamamlandi': 'Tamamlandı'
  }
  return statusMap[status] || status
}

export default GPSTrackingWidget
```

### 6. Environment Variables

#### kargomarketing.com Supabase Project:

```env
# GPS System Integration
GPS_API_KEY=production_api_key_12345
GPS_WEBHOOK_SECRET=webhook_secret_key_12345
GPS_SUPABASE_URL=https://iawqwfbvbigtbvipddao.supabase.co

# Internal Supabase (kargomarketing.com)
KARGOMARKETING_SUPABASE_URL=https://your-kargomarketing-project.supabase.co
KARGOMARKETING_SERVICE_KEY=your_service_role_key
```

## 🎯 Updated Implementation Plan

### Phase 1: Backend Integration
1. **Create Edge Functions** in kargomarketing.com Supabase:
   - `create-gps-job.ts`
   - `get-gps-tracking.ts`
   - `webhook-driver-assigned.ts`
   - `webhook-trip-started.ts`
   - `webhook-trip-completed.ts`

2. **Database Updates**:
   - Add GPS columns to `ilanlar` table
   - Create `gps_logs` table
   - Set up proper indexes

3. **Environment Setup**:
   - GPS API credentials
   - Webhook secrets
   - Cross-Supabase permissions

### Phase 2: Frontend Integration
1. **React Components**:
   - GPS tracking widget
   - Admin panel GPS management
   - Customer tracking page

2. **API Integration**:
   - Supabase client calls to internal Edge Functions
   - Real-time subscriptions for GPS updates

### Phase 3: Testing & Deployment
1. **Integration Testing**:
   - Supabase A → Supabase B communication
   - Webhook delivery verification
   - Frontend widget functionality

2. **Production Deployment**:
   - Edge Functions deployment
   - Environment variables setup
   - Monitoring and logging

## ✅ Benefits of Supabase-to-Supabase Integration

1. **Consistent Technology Stack**: Both systems use PostgreSQL and Edge Functions
2. **Built-in Security**: Supabase RLS and API key management
3. **Real-time Capabilities**: Both systems support real-time subscriptions
4. **Scalability**: Auto-scaling Edge Functions
5. **Developer Experience**: Consistent tooling and patterns

---

**This corrected approach ensures proper Supabase-to-Supabase integration without technology stack mismatches.**
