/**
 * En el lector el destinatario ya abrió el enlace. Sacamos el sobre del correo:
 * saludo, “use el enlace”, “lea este correo”, botón de acceso y fallback.
 */
export function sanitizeHtmlForReader(html: string): string {
  if (!html) return "";

  let sanitized = html;

  sanitized = sanitized.replace(
    /<!--\s*MAILBOX_META_START\s*-->[\s\S]*?<!--\s*MAILBOX_META_END\s*-->/gi,
    ""
  );

  sanitized = sanitized.replace(/<p\b[^>]*\bclass="[^"]*\blead\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi, "");

  sanitized = sanitized.replace(
    /<p[^>]*class="muted"[^>]*>[\s\S]*?Si el boton no funciona[\s\S]*?<\/p>/gi,
    ""
  );

  sanitized = sanitized.replace(
    /<p[^>]*style="margin:\s*20px\s*0;"[^>]*>[\s\S]*?(?:Acceder\s+a\s+la\s+notificaci[oó]n|Leer\s+Notificaci[oó]n)[\s\S]*?<\/p>/gi,
    ""
  );

  sanitized = sanitized.replace(/<p[^>]*>\s*<\/p>/gi, "");

  return sanitized;
}
