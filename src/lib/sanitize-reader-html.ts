/**
 * En el lector el destinatario ya abrió el enlace. Sacamos el sobre del correo:
 * saludo, “use el enlace”, “lea este correo”, botón de acceso y fallback.
 * Si el mail mezclaba globo de Meta + carta oculta, dejamos el mismo texto que Gmail
 * (el de Meta) y no la carta gemela.
 */
export function sanitizeHtmlForReader(html: string): string {
  if (!html) return "";

  let sanitized = html;
  const hadMailboxMeta = /<!--\s*MAILBOX_META_START\s*-->/i.test(sanitized);

  if (hadMailboxMeta) {
    sanitized = removeDivsWithAttr(sanitized, "data-email-hide");
    sanitized = sanitized.replace(/\s*data-reader-hide\b/gi, "");
    sanitized = sanitized.replace(/<!--\s*MAILBOX_META_START\s*-->/gi, "");
    sanitized = sanitized.replace(/<!--\s*MAILBOX_META_END\s*-->/gi, "");
  }

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

function removeDivsWithAttr(html: string, attr: string): string {
  const openRe = new RegExp(`<div\\b[^>]*\\b${attr}\\b[^>]*>`, "i");
  let out = html;
  for (;;) {
    const match = openRe.exec(out);
    if (!match) break;
    const start = match.index;
    let depth = 1;
    let i = start + match[0].length;
    while (i < out.length && depth > 0) {
      const nextOpen = out.toLowerCase().indexOf("<div", i);
      const nextClose = out.toLowerCase().indexOf("</div>", i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        i = nextClose + 6;
      }
    }
    out = `${out.slice(0, start)}${out.slice(i)}`;
    openRe.lastIndex = 0;
  }
  return out;
}
