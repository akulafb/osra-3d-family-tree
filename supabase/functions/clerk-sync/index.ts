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
      const clerkId = data.id
      const email = data.email_addresses?.[0]?.email_address
      const full_name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || null

      console.log(`[Clerk Webhook] Processing user: ${clerkId}, email: ${email}, name: ${full_name}`)

      if (!email) {
        console.warn('[Clerk Webhook] No email for user, skipping')
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      // Check for existing user with same email but old UUID id (Supabase auth migration)
      const { data: existingRows } = await supabase
        .from('users')
        .select('id, node_id, role')
        .eq('email', email)

      const isOldId = (uid: string) => !uid.startsWith('user_') && uid.includes('-')
      const existingByEmail = Array.isArray(existingRows)
        ? existingRows.find((r) => isOldId(r.id) && r.node_id != null) ?? existingRows.find((r) => isOldId(r.id))
        : null

      if (existingByEmail && existingByEmail.id !== clerkId && isOldId(existingByEmail.id)) {
        const oldId = existingByEmail.id
        console.log(`[Clerk Webhook] Migrating existing user ${oldId} -> ${clerkId} (email: ${email})`)

        // Delete duplicate row first if webhook previously created one (avoids PK conflict)
        await supabase.from('users').delete().eq('id', clerkId).is('node_id', null)

        // Update FKs in child tables, then update users.id
        await supabase.from('node_invites').update({ claimed_by_user_id: clerkId }).eq('claimed_by_user_id', oldId)
        await supabase.from('node_invites').update({ created_by_user_id: clerkId }).eq('created_by_user_id', oldId)
        await supabase.from('nodes').update({ created_by_user_id: clerkId }).eq('created_by_user_id', oldId)
        await supabase.from('audit_log').update({ actor_user_id: clerkId }).eq('actor_user_id', oldId)

        const { error: updateErr } = await supabase
          .from('users')
          .update({ id: clerkId, full_name, email })
          .eq('id', oldId)

        if (updateErr) {
          console.error('[Clerk Webhook] Migration update failed:', updateErr)
          return new Response(JSON.stringify({ error: 'Migration failed', details: updateErr }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        console.log(`[Clerk Webhook] Migrated user ${oldId} -> ${clerkId}`)
      } else {
        // New user or already migrated: upsert
        const { error } = await supabase
          .from('users')
          .upsert({ id: clerkId, full_name, email }, { onConflict: 'id' })

        if (error) {
          console.error('[Clerk Webhook] Error upserting user:', error)
          return new Response(JSON.stringify({ error: 'Database error', details: error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        console.log(`[Clerk Webhook] Successfully processed ${type} for user ${clerkId}`)
      }
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
