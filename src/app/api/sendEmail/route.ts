import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { sendEmailCfHeaders } from '@/lib/cf-send-auth';
import { sealEvidenceSnapshot } from '@/lib/evidence-snapshot';
import { getFirebaseSendEmailUrl } from '@/lib/mail-defaults';
import { guardarContactoDesdeMail } from '@/lib/contactos-server';

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
              error: 'No se envió: el destinatario no tiene adhesión electrónica activa. Para este aviso usá comunicación ordinaria, o notificá por vía convencional (carta).',
              code: 'REQUIRES_CONVENTIONAL_CHANNEL',
              reason: gate.reason,
              eligibleForElectronicNotification: false,
              conventionalChannelRequired: true,
            },
            { status: 422 }
          );
        }
      }
    }

    const usesWa = mailData.waOnly === true || Boolean(String(mailData.recipientPhone || "").trim());
    if (orgId && usesWa) {
      const { usesNotificasDefaultTemplate } = await import("@/lib/wa-template-fields");
      if (usesNotificasDefaultTemplate(mailData.waTemplateName)) {
        const { resolvePreferredOrgWaTemplate } = await import("@/lib/resolve-org-wa-template");
        const preferred = await resolvePreferredOrgWaTemplate(orgId);
        if (preferred) {
          await adminDb.collection("mail").doc(docId).update({
            waTemplateName: preferred.templateName,
            waTemplateLang: preferred.templateLang || "es_AR",
            waTemplateVariables: preferred.templateVariables,
            ...(preferred.urlButton ? { waUrlButton: true } : {}),
            ...(preferred.templateBody ? { waTemplateBody: preferred.templateBody } : {}),
          });
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

    // Polygon SEND lo dispara la Cloud Function sendEmail → /api/polygon/certify-event.
    void sealEvidenceSnapshot(docId).catch((e) =>
      console.warn('⚠️ No se pudo sellar snapshot de evidencia:', e?.message)
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error en endpoint sendEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
