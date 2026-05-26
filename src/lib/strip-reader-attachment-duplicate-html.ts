/**
 * En el correo, `sendEmail` quita `[data-email-hide]` y reinyecta adjuntos con `linkRedirect`.
 * En Firestore sigue guardándose el HTML de compose con una sección de adjuntos
 * (`data-email-hide` sin `message-content`) y enlaces directos a Storage.
 * Si el reader pinta ese HTML tal cual, el destinatario pulsa «Ver Documento» del HTML
 * y nunca se llama a `/api/track-attachment`. Eliminamos solo esos contenedores duplicados;
 * la lista trackeable la renderiza el reader con `mail.attachments`.
 */
export function stripUntrackedAttachmentSectionFromMailHtml(html: string): string {
  if (!html || !html.includes('data-email-hide')) return html;

  const lower = html.toLowerCase();
  let result = '';
  let cursor = 0;

  const findDivOpen = (from: number) => lower.indexOf('<div', from);
  const findDivClose = (from: number) => lower.indexOf('</div>', from);

  while (cursor < html.length) {
    const divOpen = findDivOpen(cursor);
    if (divOpen === -1) {
      result += html.slice(cursor);
      break;
    }
    result += html.slice(cursor, divOpen);
    const gt = html.indexOf('>', divOpen);
    if (gt === -1) {
      result += html.slice(divOpen);
      break;
    }
    const openTag = html.slice(divOpen, gt + 1);
    const ot = openTag.toLowerCase();
    const hasHide = ot.includes('data-email-hide');
    const hasMsgContent = ot.includes('message-content');
    if (hasHide && !hasMsgContent) {
      let depth = 1;
      let p = gt + 1;
      while (p < html.length && depth > 0) {
        const nextOpen = findDivOpen(p);
        const nextClose = findDivClose(p);
        if (nextClose === -1) {
          depth = -1;
          break;
        }
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          const nextGt = html.indexOf('>', nextOpen);
          if (nextGt === -1) {
            depth = -1;
            break;
          }
          p = nextGt + 1;
        } else {
          depth--;
          p = nextClose + 6;
        }
      }
      if (depth !== 0) {
        result += html.slice(divOpen);
        break;
      }
      cursor = p;
      continue;
    }
    result += openTag;
    cursor = gt + 1;
  }
  return result;
}
