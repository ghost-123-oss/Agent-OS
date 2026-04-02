import { createClient } from "@supabase/supabase-js";

/**
 * Creates a shared server-side Supabase client factory.
 * This ensures consistent configuration and reduces redundant client creation.
 */
export function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
