const { FieldValue } = require('firebase-admin/firestore');

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function looksLikeBouncePayload(body) {
  const from = str(body?.from).toLowerCase();
  const subject = str(body?.subject).toLowerCase();
  if (/mailer-daemon|postmaster|mail-daemon/.test(from)) return true;
  if (
    /undeliverable|delivery status|failure notice|returned mail|mail delivery failed|rebote|no se pudo entregar|delivery failure/.test(
      subject
    )
  ) {
    return true;
  }
  const type = str(body?.type || body?.event).toLowerCase();
  return type === 'bounce' || type === 'bounced' || type === 'complaint';
}

function blobFromBody(body) {
  return [
    body?.to,
    body?.originalTo,
    body?.recipient,
    body?.subject,
    body?.text,
    body?.html,
    body?.mailId,
    body?.messageId,
    body?.smtpMessageId,
  ]
    .map((v) => str(v))
    .join('\n');
}

function extractMailIdFromBounceBlob(blob) {
  const verp = blob.match(/contacto\+b\.([A-Za-z0-9_-]{8,})@/i);
  if (verp) return verp[1];
  const hdr = blob.match(/X-Notificas-Mail-Id:\s*([A-Za-z0-9_-]+)/i);
  if (hdr) return hdr[1];
  return null;
}

function extractOriginalMessageId(blob) {
  const original = blob.match(/Original-Message-ID:\s*<?([^>\s]+)>?/i);
  return original ? original[1].trim() : null;
}

async function applyEmailBounce(db, input) {
  let mailId = (input.mailId || '').trim();
  const smtpMessageId = (input.smtpMessageId || '').trim();
  if (!mailId && smtpMessageId) {
    const snap = await db.collection('mail').where('smtpMessageId', '==', smtpMessageId).limit(1).get();
    if (!snap.empty) mailId = snap.docs[0].id;
  }
  if (!mailId) return null;
  const ref = db.collection('mail').doc(mailId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const mail = snap.data();
  if (mail.emailBounce) return { mailId };

  const at = new Date().toISOString();
  const reason = (input.reason || '').trim() || 'El servidor de destino rechazó el mensaje';
  const movement = {
    id: `bounce-${Date.now()}`,
    type: 'email_bounced',
    description: reason,
    timestamp: at,
    userAgent: 'Server',
    clientIP: 'Server',
    browser: 'Server',
  };

  await ref.update({
    emailBounce: {
      type: input.type || 'bounce',
      reason,
      at,
      recipient: input.recipient || mail.recipientEmail || null,
    },
    'tracking.movements': FieldValue.arrayUnion(movement),
  });

  await db.collection('provider_events').add({
    mailId,
    campaignId: mail.campaignId || null,
    campaignMessageId: mail.campaignMessageId || null,
    provider: 'smtp',
    eventType: input.type || 'bounce',
    providerMessageId: smtpMessageId || mail.smtpMessageId || null,
    recipient: input.recipient || mail.recipientEmail || null,
    providerTimestamp: at,
    raw: input.raw || { reason },
    receivedAt: FieldValue.serverTimestamp(),
  });

  return { mailId };
}

async function applyEmailBounceFromPayload(db, body) {
  const blob = blobFromBody(body || {});
  const mailId = str(body.mailId) || extractMailIdFromBounceBlob(blob) || '';
  const smtpMessageId =
    str(body.smtpMessageId) || str(body.messageId) || extractOriginalMessageId(blob) || '';
  const typeRaw = str(body.type || body.event).toLowerCase();
  const type = typeRaw === 'complaint' || typeRaw === 'complained' ? 'complaint' : 'bounce';
  return applyEmailBounce(db, {
    mailId,
    smtpMessageId,
    type,
    reason: str(body.reason || body.diagnostic || body.subject),
    recipient: str(body.recipient),
    raw: body,
  });
}

module.exports = {
  looksLikeBouncePayload,
  applyEmailBounce,
  applyEmailBounceFromPayload,
};
