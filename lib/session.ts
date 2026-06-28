/**
 * Anonymous per-visit session token.
 *
 * A random token (NOT a user id, no PII) persisted in sessionStorage so a scan
 * and the route it leads to can be linked into a funnel for the visit. Cleared
 * when the tab closes. Client-only — returns null if called on the server or if
 * storage is unavailable.
 */
const SESSION_KEY = "bc_session_id";

function newToken(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for the rare context without crypto.randomUUID (still anonymous).
    return `bc_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = newToken();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null; // sessionStorage blocked (e.g. private mode restrictions)
  }
}
