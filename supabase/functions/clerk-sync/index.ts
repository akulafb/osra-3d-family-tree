import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Clerk webhook sends a POST request
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const { type, data } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (type === 'user.created' || type === 'user.updated') {
      const { id, first_name, last_name, image_url, email_addresses } = data
      const email = email_addresses?.[0]?.email_address
      const full_name = `${first_name ?? ''} ${last_name ?? ''}`.trim() || null

      const { error } = await supabase
        .from('users')
        .upsert({
          id,
          full_name,
          avatar_url: image_url,
          email,
        })

      if (error) {
        console.error('Error upserting user:', error)
        return new Response(JSON.stringify(error), { status: 400 })
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
