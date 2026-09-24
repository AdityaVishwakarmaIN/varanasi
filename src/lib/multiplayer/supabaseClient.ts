import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '@/lib/features';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Lazily create the shared Supabase client on first use.
 * Returns null when co-op is disabled (`FEATURES.coop`) or Supabase is not configured,
 * so importing multiplayer modules never opens a network connection by itself.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!FEATURES.coop || !supabaseUrl || !supabaseKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseKey);
  return client;
}
