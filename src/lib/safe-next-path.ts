/**
 * Evita open redirects: solo rutas relativas internas.
 */
export function safeNextPath(raw: string | null): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(t)) return null;
  return t;
}
