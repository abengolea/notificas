import type { DecodedIdToken } from 'firebase-admin/auth';

export function emailLower(s: string | undefined | null): string {
  return (s || '').toLowerCase();
}

/** Misma idea que `mailReadable` en Firestore: remitente o destinatario del mensaje. */
export function userHasMailDocumentAccess(
  mailData: Record<string, unknown>,
  decoded: DecodedIdToken
): boolean {
  if (mailData.createdBy === decoded.uid) return true;

  const email = decoded.email;
  if (!email) return false;

  const emailL = emailLower(email);

  const recipientEmail = mailData.recipientEmail;
  if (typeof recipientEmail === 'string' && emailLower(recipientEmail) === emailL) return true;

  const senderName = mailData.senderName;
  if (typeof senderName === 'string' && emailLower(senderName) === emailL) return true;

  const toList = mailData.to;
  if (Array.isArray(toList)) {
    return toList.some(
      (t) => typeof t === 'string' && (emailLower(t) === emailL || t === email)
    );
  }

  return false;
}

export function isMailSenderForCertify(
  mailData: Record<string, unknown>,
  decoded: DecodedIdToken
): boolean {
  if (mailData.createdBy === decoded.uid) return true;
  const email = decoded.email;
  const senderName = mailData.senderName;
  return Boolean(
    email && typeof senderName === 'string' && emailLower(senderName) === emailLower(email)
  );
}

export function isMailRecipientForCertify(
  mailData: Record<string, unknown>,
  decoded: DecodedIdToken
): boolean {
  const email = decoded.email;
  if (!email) return false;
  const emailL = emailLower(email);
  const recipientEmail = mailData.recipientEmail;
  if (typeof recipientEmail === 'string' && emailLower(recipientEmail) === emailL) return true;
  const toList = mailData.to;
  if (Array.isArray(toList)) {
    return toList.some(
      (t) => typeof t === 'string' && (emailLower(t) === emailL || t === email)
    );
  }
  return false;
}

/** Identificador de destinatario para payloads READ/RECEIVE (no confiar en el body). */
export function recipientIdentifierForPolygon(mailData: Record<string, unknown>): string {
  const rec = mailData.recipientEmail;
  if (typeof rec === 'string' && rec.length > 0) return rec;
  const to = mailData.to;
  if (Array.isArray(to) && to.length > 0 && typeof to[0] === 'string') return to[0];
  return 'recipient';
}
