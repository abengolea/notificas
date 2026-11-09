/**
 * ¿Quien mira es el remitente del mensaje?
 *
 * Las acciones del remitente (abrir el lector, abrir un adjunto) NO deben registrarse como
 * acciones del destinatario: lo que se certifica es que el DESTINATARIO accedió.
 * Mismo criterio que `track-app-open` y `track-attachment`.
 */
export type MailViewer = { uid: string; email: string };

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isMailSender(
  viewer: MailViewer | null | undefined,
  messageData: Record<string, unknown> | null | undefined,
): boolean {
  if (!viewer || !messageData) return false;
  const email = normalizeEmail(viewer.email);
  if (viewer.uid && typeof messageData.createdBy === 'string' && messageData.createdBy === viewer.uid) {
    return true;
  }
  if (!email) return false;
  return (
    normalizeEmail(messageData.senderName) === email ||
    normalizeEmail(messageData.replyTo) === email
  );
}
