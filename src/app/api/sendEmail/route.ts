import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { computeContentHash } from '@/lib/certification';
import { certificarEnvio, certifyWhatsAppPayloadIfNeeded } from '@/lib/certification-polygon';
import { sendEmailCfHeaders } from '@/lib/cf-send-auth';
import { sealEvidenceSnapshot } from '@/lib/evidence-snapshot';
import { getFirebaseSendEmailUrl } from '@/lib/mail-defaults';
import { guardarContactoDesdeMail } from '@/lib/contactos-server';

/** Certifica el envío en Polygon en segundo plano — nunca bloquea la respuesta HTTP. */
async function certifyInBackground(docId: string): Promise<void> {
  try {
    const snap = await adminDb.collection('mail').doc(docId).get();
    const mailData = snap.data();
    if (!mailData) return;

    const toEmail = Array.isArray(mailData.to)
      ? mailData.to[0]
      : mailData.recipientEmail || mailData.to || '';
    const fromUserId = mailData.createdBy || mailData.senderName || 'app';
    const contentHash = await computeContentHash(mailData.message?.contentText || '');

    const polygonTxHash = await Promise.race([
      certificarEnvio(docId, fromUserId, toEmail, contentHash),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout certificación Polygon (>40s)')), 40_000)
      ),
    ]);

    await adminDb.collection('mail').doc(docId).update({
      'polygonCertifications.send': polygonTxHash,
      'polygonCertifications.contentHash': contentHash,
      'polygonCertifications.updatedAt': new Date(),
    });
    console.log('🔗 Envío certificado en Polygon:', polygonTxHash);
    await certifyWhatsAppPayloadIfNeeded(docId).catch((e) =>
      console.warn('⚠️ Certificación aviso WhatsApp:', e instanceof Error ? e.message : e)
    );
  } catch (err: any) {
    console.error('⚠️ Error certificando en Polygon (no afecta el envío):', err?.message);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { docId } = await request.json();

    if (!docId) {
      return NextResponse.json({ error: 'docId es requerido' }, { status: 400 });
    }

    // Verificar que el documento pertenece al usuario autenticado
    const mailSnap = await adminDb.collection('mail').doc(docId).get();
    if (!mailSnap.exists) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }
    if (mailSnap.data()?.createdBy !== decoded.uid) {
      return NextResponse.json({ error: 'No autorizado para enviar este mensaje' }, { status: 403 });
    }

    const mailData = mailSnap.data() || {};
    const orgId = typeof mailData.orgId === 'string' ? mailData.orgId : '';
    if (orgId) {
      const { assertArtOutboundClassification, assertArtPilotOutboundRecipient } = await import('@/lib/art/outbound-guards');
      const classified = assertArtOutboundClassification(orgId, mailData.notificationType);
      if (!classified.ok) {
        return NextResponse.json({ error: classified.code, code: classified.code }, { status: classified.httpStatus });
      }
      const dest = assertArtPilotOutboundRecipient({
        orgId,
        email: Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to,
        phone: mailData.recipientPhone,
      });
      if (!dest.ok) {
        return NextResponse.json({ error: dest.code, code: dest.code }, { status: dest.httpStatus });
      }
      if (classified.value === 'SRT_ART' || mailData.notificationType === 'SRT_ART') {
        const { checkSrtArtEligibility } = await import('@/lib/art/srt-gate');
        const gate = await checkSrtArtEligibility({
          orgId,
          notificationType: 'SRT_ART',
          dni: mailData.recipientDni,
          phone: mailData.recipientPhone,
          email: Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to,
        });
        if (gate && !gate.eligibleForElectronicNotification) {
          return NextResponse.json(
            {
              error: 'REQUIRES_CONVENTIONAL_CHANNEL',
              code: gate.reason,
              eligibleForElectronicNotification: false,
              conventionalChannelRequired: true,
            },
            { status: 422 }
          );
        }
      }
    }

    // Llamar a la Cloud Function para enviar email + WhatsApp
    const functionUrl = getFirebaseSendEmailUrl();
    const cfController = new AbortController();
    const cfTimeout = setTimeout(() => cfController.abort(), 55_000);
    let response: Response;
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: sendEmailCfHeaders(),
        body: JSON.stringify({ docId }),
        signal: cfController.signal,
      });
    } catch (fetchErr: any) {
      const msg = fetchErr?.name === 'AbortError'
        ? 'Timeout al llamar la función de envío (>55s)'
        : fetchErr?.message;
      console.error('❌ Error/timeout llamando Cloud Function:', msg);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    } finally {
      clearTimeout(cfTimeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 });
    }

    const result = await response.json();

    if (orgId && (mailData.notificationType === 'SRT_ART' || mailData.notificationType === 'ORDINARY')) {
      void (async () => {
        const { artModuleAvailableForOrg } = await import('@/lib/art/pilot');
        if (!artModuleAvailableForOrg(orgId)) return;
        const { findRecipientForSrt } = await import('@/lib/art/store');
        const { appendArtAuditEvent } = await import('@/lib/art/audit');
        const rec = await findRecipientForSrt(orgId, {
          dni: mailData.recipientDni,
          phone: mailData.recipientPhone,
          email: Array.isArray(mailData.to) ? mailData.to[0] : mailData.recipientEmail || mailData.to,
        });
        await appendArtAuditEvent({
          orgId,
          recipientId: rec?.id || null,
          type: 'NOTIFICATION_SENT',
          actor: decoded.uid,
          source: 'individual_send',
          metadata: {
            notificationType: mailData.notificationType,
            mailId: docId,
          },
        });
      })().catch(() => undefined);
    }

    // Guardar destinatario en libreta personal (no bloquea la respuesta).
    void guardarContactoDesdeMail(mailSnap.data()!);

    // Lanzar la certificación Polygon sin await — responde al cliente YA.
    // El void es intencional: Polygon es best-effort y nunca debe bloquear la UI.
    void certifyInBackground(docId);
    void sealEvidenceSnapshot(docId).catch((e) =>
      console.warn('⚠️ No se pudo sellar snapshot de evidencia:', e?.message)
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en endpoint sendEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
