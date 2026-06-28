import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client (anon / publishable key).
 *
 * Uses only the PUBLIC values (NEXT_PUBLIC_*), which are designed to be exposed to
 * the browser and are gated by Row Level Security. This client is for read/realtime
 * use from the app. NEVER put the service-role / secret key in this file — use
 * lib/supabaseAdmin.ts (server-only) for privileged access.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `[supabaseClient] Missing required env var(s): ${missing}. ` +
      `Set them in .env.local (see .env.example).`,
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
