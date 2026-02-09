import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase Client] Initializing with:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyPreview: supabaseAnonKey?.substring(0, 20) + '...'
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

// Create Supabase client with realtime explicitly disabled
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    // Disable realtime heartbeat and connection pooling
    // @ts-ignore - params might not be in types but is supported
    params: {
      eventsPerSecond: 0,
    },
  },
  db: {
    schema: 'public',
  },
});

// Attempt to remove all realtime subscriptions on init
// @ts-ignore - internal API
if (supabase.realtime?.channels) {
  // @ts-ignore
  supabase.realtime.channels.forEach((channel: any) => {
    // @ts-ignore
    supabase.realtime.removeChannel(channel);
  });
}

console.log('[Supabase Client] Client created with realtime disabled');
