// @ts-nocheck
// 🌉 BRIDGE SYSTEM: Backend1 ↔ Backend2 Bağlantısı
// GPS Backend'inde çalışan Edge Function

// Bridge API: GPS Backend ↔ Backend1 Communication
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

// 📡 Real-time GPS: Backend2 → Backend1 (Anlık, depolama yok)
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
