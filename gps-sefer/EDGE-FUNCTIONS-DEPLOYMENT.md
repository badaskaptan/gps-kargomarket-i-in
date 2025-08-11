# 🚀 Edge Functions Deployment Rehberi

## 📋 Deployment Checklist

### ✅ Tamamlanan Hazırlıklar
- [x] Edge Functions kodları hazır
- [x] Deno.json konfigürasyonu 
- [x] TypeScript hataları düzeltildi
- [x] CORS ayarları yapıldı

### 🎯 Deployment Adımları

## 1️⃣ Supabase Dashboard'a Giriş

1. **Supabase Dashboard**'a git: https://supabase.com/dashboard
2. **Projen'i seç**: `iawqwfbvbigtbvipddao` 
3. Sol menüden **"Edge Functions"** sekmesine tıkla

## 2️⃣ Environment Variables Setup (İLK ÖNCE BU!)

**Önemli**: Fonksiyonları deploy etmeden önce environment variables'ları ayarla!

1. Dashboard'da **Settings → Environment Variables** git
2. Bu değişkenleri ekle:

```env
# Production için
BACKEND_1_API_KEY=production_api_key_12345
BACKEND_1_WEBHOOK_URL=https://kargomarketing.com/api/webhook/gps

# Test için (şimdilik)
BACKEND_1_API_KEY=test_api_key_123
BACKEND_1_WEBHOOK_URL=https://webhook.site/#!/your-unique-url
```

3. **Save** butonuna tıkla

## 3️⃣ Edge Functions Deployment

### Function 1: create-job

1. **Edge Functions** sayfasında **"Create Function"** tıkla
2. **Function Details**:
   - **Name**: `create-job`
   - **Region**: `us-east-1` (varsayılan)
3. **Code Editor**'da şu kodu yapıştır:

```typescript
// @deno-types="https://deno.land/types/deploy/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Backend #1'den sadece ilan bilgileri gelir
    const { 
      ilan_no, 
      customer_info, 
      delivery_address, 
      varis_konum,
      priority,
      deadline,
      cargo_type,
      api_key 
    } = await req.json()

    // API key kontrolü (Backend #1 authentication)
    if (api_key !== Deno.env.get('BACKEND_1_API_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase bağlantısı
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // İlan zaten var mı kontrol et
    const { data: existingJob } = await supabase
      .from('gorevler')
      .select('id, sefer_durumu')
      .eq('ilan_no', ilan_no)
      .single()

    if (existingJob) {
      return new Response(
        JSON.stringify({ 
          error: 'Job already exists', 
          existing_status: existingJob.sefer_durumu,
          job_id: existingJob.id 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Görev oluştur (şoför atanmamış durumda)
    const { data: job, error } = await supabase
      .from('gorevler')
      .insert({
        ilan_no,
        sofor_id: null, // Henüz şoför atanmadı
        sefer_durumu: 'atanmamis', // Yeni durum: atanmamış
        customer_info: customer_info || {},
        delivery_address: delivery_address || {},
        priority: priority || 'normal',
        deadline: deadline || null,
        cargo_type: cargo_type || null,
        varis_konum: varis_konum ? 
          `POINT(${varis_konum[1]} ${varis_konum[0]})` : null
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create job', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        ilan_no: job.ilan_no,
        status: job.sefer_durumu,
        message: 'Job created successfully, waiting for driver assignment'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

4. **Deploy Function** butonuna tıkla
5. Deployment tamamlanmasını bekle (1-2 dakika)

### Function 2: assign-driver

1. **Create Function** → **Name**: `assign-driver`
2. Kodu yapıştır:

```typescript
// @deno-types="https://deno.land/types/deploy/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Admin panelden şoför atama
    const { job_id, driver_id, admin_user_id } = await req.json()

    // Admin yetki kontrolü (gerçek projede JWT token kontrol edilecek)
    if (!admin_user_id) {
      return new Response(
        JSON.stringify({ error: 'Admin authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // İş kaydını güncelle
    const { data: job, error } = await supabase
      .from('gorevler')
      .update({
        sofor_id: driver_id,
        sefer_durumu: 'atandi', // Şoför atandı ama henüz onaylamadı
        updated_at: new Date().toISOString()
      })
      .eq('id', job_id)
      .select('*, ilan_no')
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to assign driver', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Backend #1'e webhook gönder (isteğe bağlı)
    const webhookUrl = Deno.env.get('BACKEND_1_WEBHOOK_URL')
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'driver_assigned',
            ilan_no: job.ilan_no,
            driver_id: driver_id,
            job_id: job_id
          })
        })
      } catch (webhookError) {
        console.error('Webhook error:', webhookError)
        // Webhook hatası ana işlemi etkilemez
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Driver assigned successfully',
        job_id: job.id,
        ilan_no: job.ilan_no,
        driver_id: driver_id,
        status: job.sefer_durumu
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

3. **Deploy Function**

### Function 3: get-tracking

1. **Create Function** → **Name**: `get-tracking`
2. Kodu yapıştır:

```typescript
// @deno-types="https://deno.land/types/deploy/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Backend #1'den tracking bilgisi istenir
    const { ilan_no, api_key } = await req.json()

    // API key kontrolü
    if (api_key !== Deno.env.get('BACKEND_1_API_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // İlan numarasına göre aktif görev bul
    const { data: job, error } = await supabase
      .from('gorevler')
      .select(`
        id,
        ilan_no,
        sefer_durumu,
        konum_gecmisi,
        son_konum,
        baslangic_zamani,
        bitis_zamani,
        created_at,
        updated_at
      `)
      .eq('ilan_no', ilan_no)
      .single()

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found', ilan_no }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Konum geçmişini parse et
    let locationHistory = []
    if (job.konum_gecmisi) {
      try {
        locationHistory = typeof job.konum_gecmisi === 'string' 
          ? JSON.parse(job.konum_gecmisi) 
          : job.konum_gecmisi
      } catch (parseError) {
        console.error('Location history parse error:', parseError)
      }
    }

    // Son konumu parse et
    let lastLocation = null
    if (job.son_konum) {
      try {
        lastLocation = typeof job.son_konum === 'string' 
          ? JSON.parse(job.son_konum) 
          : job.son_konum
      } catch (parseError) {
        console.error('Last location parse error:', parseError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ilan_no: job.ilan_no,
        job_id: job.id,
        status: job.sefer_durumu,
        tracking_data: {
          last_location: lastLocation,
          location_history: locationHistory,
          trip_start: job.baslangic_zamani,
          trip_end: job.bitis_zamani,
          last_update: job.updated_at,
          total_points: locationHistory.length
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

3. **Deploy Function**

### Function 4: driver-approve

1. **Create Function** → **Name**: `driver-approve`
2. Kodu yapıştır:

```typescript
// @deno-types="https://deno.land/types/deploy/index.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Mobil uygulamadan şoför onayı
    const { job_id, driver_id, approve, driver_notes } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Şoför bu görevi onaylayabilir mi kontrol et
    const { data: job, error: fetchError } = await supabase
      .from('gorevler')
      .select('*')
      .eq('id', job_id)
      .eq('sofor_id', driver_id)
      .single()

    if (fetchError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found or unauthorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (job.sefer_durumu !== 'atandi') {
      return new Response(
        JSON.stringify({ 
          error: 'Job is not in assignable state', 
          current_status: job.sefer_durumu 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Şoför onayına göre durumu güncelle
    const newStatus = approve ? 'onaylandi' : 'reddedildi'
    const updateData: any = {
      sefer_durumu: newStatus,
      driver_approved: approve,
      updated_at: new Date().toISOString()
    }

    // Şoför reddetmişse, şoförlü atamasını temizle
    if (!approve) {
      updateData.sofor_id = null
      updateData.sefer_durumu = 'atanmamis'
    }

    // Driver notes varsa ekle
    if (driver_notes) {
      updateData.driver_notes = driver_notes
    }

    const { data: updatedJob, error: updateError } = await supabase
      .from('gorevler')
      .update(updateData)
      .eq('id', job_id)
      .select('*, ilan_no')
      .single()

    if (updateError) {
      console.error('Database error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update job', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Backend #1'e webhook gönder
    const webhookUrl = Deno.env.get('BACKEND_1_WEBHOOK_URL')
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: approve ? 'job_approved' : 'job_rejected',
            ilan_no: updatedJob.ilan_no,
            driver_id: driver_id,
            job_id: job_id,
            driver_notes: driver_notes || null
          })
        })
      } catch (webhookError) {
        console.error('Webhook error:', webhookError)
        // Webhook hatası ana işlemi etkilemez
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: approve ? 'Job approved successfully' : 'Job rejected',
        job_id: updatedJob.id,
        ilan_no: updatedJob.ilan_no,
        status: updatedJob.sefer_durumu,
        approved: approve
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

3. **Deploy Function**

## 4️⃣ Test Etme

### Test Panel ile API Test

1. `backend1-test-panel.html` dosyasını tarayıcıda aç
2. **İş Emri Oluştur** butonuna tıkla
3. Response'ları kontrol et

### Manual Test (Postman/curl)

```bash
# create-job test
curl -X POST https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "test_api_key_123",
    "ilan_no": "TEST_001",
    "customer_info": {"name": "Test Müşteri"},
    "delivery_address": {"city": "İstanbul"},
    "priority": "urgent"
  }'
```

## 5️⃣ Deployment Verification

### Kontrol Listesi:
- [ ] 4 Edge Function deploy edildi
- [ ] Environment variables ayarlandı
- [ ] Test panelinden başarılı response geldi
- [ ] Database'de test verisi oluştu
- [ ] Error logları temiz

### Hata Durumunda:
1. **Supabase Dashboard → Edge Functions → Function Name → Logs**
2. **Error mesajlarını kontrol et**
3. **Environment variables'ları doğrula**

## ✅ Deployment Tamamlandı!

Artık kargomarketing.com'dan bu API endpoint'leri kullanabilirsin:

- `https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/create-job`
- `https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/assign-driver`
- `https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/get-tracking`
- `https://iawqwfbvbigtbvipddao.supabase.co/functions/v1/driver-approve`
