import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { ilan_no, customer_info, delivery_address } = await req.json()
  if (!ilan_no || !customer_info) {
    return new Response(JSON.stringify({ error: 'Eksik veri' }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Zaten varsa ekleme
  const { data: existing } = await supabase
    .from('gorevler')
    .select('id')
    .eq('ilan_no', ilan_no)
    .limit(1)

  if (existing && existing.length > 0) {
    return new Response(JSON.stringify({ error: 'İlan zaten var' }), { status: 409 })
  }

  // Yeni görev ekle
  const { error } = await supabase
    .from('gorevler')
    .insert([{
      ilan_no,
      sefer_durumu: 'atanmamis',
      customer_info,
      delivery_address
    }])

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
