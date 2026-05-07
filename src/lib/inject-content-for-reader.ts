export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Reemplaza CONTENT_PLACEHOLDER en el HTML con el contenido real y detalles.
 * Solo para visualización en reader/dashboard; el email nunca incluye este contenido.
 */
export function injectContentForReader(
  html: string,
  mail: { message?: { content?: string; details?: { priority?: string; requireCertificate?: boolean; fecha?: string; attachmentsCount?: number } } }
): string {
  if (!html) return "";
  const content = mail?.message?.content || "";
  const details = mail?.message?.details;
  let contentHtml = "";
  if (content) {
    contentHtml += `<div style="margin: 20px 0;">
      <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Contenido del Mensaje:</h2>
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
        ${content.split('\n').map(line => `<p style="margin: 0 0 8px 0; line-height: 1.6; color: #334155;">${escapeHtml(line)}</p>`).join('')}
      </div>
    </div>`;
  }
  if (details) {
    contentHtml += `<div style="background: #f1f5f9; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Detalles del Envío:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px;">
        <li>Prioridad: <strong>${escapeHtml(details.priority || 'normal')}</strong></li>
        <li>Certificado requerido: <strong>${details.requireCertificate ? 'Sí' : 'No'}</strong></li>
        <li>Fecha: <strong>${escapeHtml(details.fecha || '-')}</strong></li>
        ${(details.attachmentsCount || 0) > 0 ? `<li>Documentos adjuntos: <strong>${details.attachmentsCount} archivo(s) con hash de integridad</strong></li>` : ''}
      </ul>
    </div>`;
  }
  return html.replace(/<!--\s*CONTENT_PLACEHOLDER[^>]*-->/i, contentHtml);
}
