// @ts-nocheck
// Deno Edge Function - TypeScript errors normal (Deno runtime'da çalışır)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the request body
    const { ilan_no, customer_info, delivery_address, api_key } = await req.json()

    // Validate API key (kargomarketing.com authentication)
    if (api_key !== 'KARGOMARKETING_API_KEY_2025') {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate required fields
    if (!ilan_no || !customer_info || !delivery_address) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: ilan_no, customer_info, delivery_address' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Initialize Supabase client (GPS backend)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if ilan_no already exists
    const { data: existingTask } = await supabase
      .from('gorevler')
      .select('id')
      .eq('ilan_no', ilan_no)
      .single()

    if (existingTask) {
      return new Response(
        JSON.stringify({ error: 'Task with this ilan_no already exists' }),
        { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Insert new task
    const { data, error } = await supabase
      .from('gorevler')
      .insert({
        ilan_no,
        customer_info,
        delivery_address,
        sefer_durumu: 'beklemede', // waiting for driver assignment
        created_at: new Date().toISOString()
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create task' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Task created successfully',
        task_id: data[0].id,
        ilan_no: data[0].ilan_no
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
