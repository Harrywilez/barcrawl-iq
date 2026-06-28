import { createClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY Supabase client — full service-role / secret privileges (bypasses RLS).
 *
 * ⚠️ SECURITY — read before using:
 *   - NEVER import this module into client/browser code (React Client Components,
 *     anything that ships to the browser).
 *   - NEVER move SUPABASE_SERVICE_ROLE_KEY into a NEXT_PUBLIC_* variable.
 *
 * Why this is safe: the key is read from a NON-public env var, so Next.js will not
 * inline it into the client bundle — it cannot reach the browser through this file.
 * The `typeof window` check below is an extra runtime tripwire. For build-time
 * enforcement you may also add `import "server-only";` at the top of this file
 * (requires `npm i server-only`); a client-side import then fails the build.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "[supabaseAdmin] This module is server-only and must never run in the browser.",
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(
    `[supabaseAdmin] Missing required env var(s): ${missing}. ` +
      `Set them in the server environment (.env.local).`,
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  // Server clients should not persist or auto-refresh a user session.
  auth: { autoRefreshToken: false, persistSession: false },
});
