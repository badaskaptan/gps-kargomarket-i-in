// @deno-types="https://deno.land/x/supabase@1.103.0/mod.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { api_key, ilan_no, driver_id, driver_email, action } = await req.json()

    // API Key validation
    const validApiKeys = ['production_api_key_12345', 'test_api_key_123']
    if (!validApiKeys.includes(api_key)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid API key'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase client with service key
  const supabase = createClient(
    'https://tbepkrfktjofmhxcpfgo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiZXBrcmZrdGpvZm1oeGNwZmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTgyNzI1MSwiZXhwIjoyMDY3NDAzMjUxfQ.v6hfhS5jIEQT7Xjzr_BNLPQ_PxZLkskkKC-Pz9Zt2bE'
  )    // 1. İlan numarasının mevcut olup olmadığını kontrol et
    const { data: existingTask, error: fetchError } = await supabase
      .from('gorevler')
      .select('*')
      .eq('ilan_no', ilan_no)
      .single()

    if (fetchError || !existingTask) {
      return new Response(JSON.stringify({
        success: false,
        error: `İlan numarası "${ilan_no}" bulunamadı. Bu ilan henüz GPS sistemine gönderilmemiş olabilir.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Eğer görev zaten başka bir şöföre atanmışsa
    if (existingTask.driver_id && existingTask.driver_id !== driver_id) {
      return new Response(JSON.stringify({
        success: false,
        error: `Bu ilan zaten başka bir şöföre atanmış (Driver ID: ${existingTask.driver_id})`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Şöför bilgilerini güncelle
    const { data: updatedTask, error: updateError } = await supabase
      .from('gorevler')
      .update({
        driver_id: driver_id,
        driver_email: driver_email,
        sefer_durumu: 'atandi', // Şöför atandı durumu
        updated_at: new Date().toISOString()
      })
      .eq('ilan_no', ilan_no)
      .select()
      .single()

    if (updateError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Görev güncellenirken hata oluştu: ' + updateError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Başarılı bağlantı sonrası kargomarketing.com'a webhook gönder
    try {
      // Bu URL kargomarketing.com tarafından sağlanacak
      const webhookUrl = 'https://kargomarketing-supabase-url.supabase.co/functions/v1/webhook-handler'
      
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api_key
        },
        body: JSON.stringify({
          type: 'driver_connected',
          ilan_no: ilan_no,
          driver_id: driver_id,
          driver_email: driver_email,
          timestamp: new Date().toISOString()
        })
      })
    } catch (webhookError) {
      console.log('Webhook gönderimi başarısız:', webhookError)
      // Webhook hatası görev atamasını engellemez
    }

    // 5. Başarılı sonuç
    return new Response(JSON.stringify({
      success: true,
      message: 'Şöför başarıyla atandı',
      task_status: updatedTask.sefer_durumu,
      ilan_no: ilan_no,
      customer_info: updatedTask.customer_info,
      delivery_address: updatedTask.delivery_address,
      driver_id: driver_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Driver approve error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Bilinmeyen hata oluştu'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/* 
USAGE EXAMPLE:

POST /functions/v1/driver-approve
{
  "api_key": "production_api_key_12345",
  "ilan_no": "KRG2025001",
  "driver_id": "123e4567-e89b-12d3-a456-426614174000",
  "driver_email": "sofor@example.com",
  "action": "request_connection"
}

RESPONSE:
{
  "success": true,
  "message": "Şöför başarıyla atandı",
  "task_status": "atandi",
  "ilan_no": "KRG2025001",
  "customer_info": {"name": "ABC Ltd", "phone": "+90 555 123 4567"},
  "delivery_address": {"city": "İstanbul", "district": "Kadıköy"},
  "driver_id": "123e4567-e89b-12d3-a456-426614174000"
}
*/
