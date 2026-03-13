import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email_addresses: ClerkEmailAddress[];
  // Other fields from Clerk can be added here if needed
}

interface ClerkWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  data: ClerkUserData;
}

serve(async (req) => {
  const requestUrl = req.url
  console.log(`[Clerk Webhook] Received request to ${requestUrl}`)

  // Clerk webhook sends a POST request
  if (req.method !== 'POST') {
    console.warn(`[Clerk Webhook] Method ${req.method} not allowed`)
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload: ClerkWebhookEvent = await req.json()
    const { type, data } = payload
    
    console.log(`[Clerk Webhook] Processing event type: ${type} for user: ${data.id}`)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Clerk Webhook] Missing Supabase environment variables')
      return new Response('Internal Server Error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (type === 'user.created' || type === 'user.updated') {
      const { id, first_name, last_name, email_addresses } = data
      const email = email_addresses?.[0]?.email_address
      const full_name = [first_name, last_name].filter(Boolean).join(' ').trim() || null

      console.log(`[Clerk Webhook] Upserting user: ${id}, email: ${email}, name: ${full_name}`)

      const { error } = await supabase
        .from('users')
        .upsert({
          id,
          full_name,
          email,
        })

      if (error) {
        console.error('[Clerk Webhook] Error upserting user in Supabase:', error)
        return new Response(JSON.stringify({ error: 'Database error', details: error }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      console.log(`[Clerk Webhook] Successfully processed ${type} for user ${id}`)
    } else if (type === 'user.deleted') {
      // Handle user deletion if needed
      console.log(`[Clerk Webhook] User deletion event received for ${data.id} - no action taken yet`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('[Clerk Webhook] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
