import { NextRequest, NextResponse } from 'next/server';
import {
  certificarLectura,
  certificarEnvio,
  certificarRecepcion,
  certificarUsuario,
} from '@/lib/certification-polygon';
import { verifyAuthToken } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase-admin';
import { computeContentHash } from '@/lib/certification';
import {
  userHasMailDocumentAccess,
  isMailSenderForCertify,
  isMailRecipientForCertify,
  recipientIdentifierForPolygon,
} from '@/lib/mail-access-server';

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { type } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Tipo de certificación requerido: send, read, receive, user' },
        { status: 400 }
      );
    }

    let txHash: string;

    switch (type) {
      case 'read':
      case 'send':
      case 'receive': {
        const messageId = body.messageId;
        if (!messageId || typeof messageId !== 'string') {
          return NextResponse.json({ error: 'messageId es requerido' }, { status: 400 });
        }

        const snap = await adminDb.collection('mail').doc(messageId).get();
        if (!snap.exists) {
          return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
        }

        const mailData = snap.data() as Record<string, unknown>;

        if (type === 'send') {
          if (!isMailSenderForCertify(mailData, decoded)) {
            return NextResponse.json({ error: 'No autorizado para certificar el envío' }, { status: 403 });
          }
          const toEmail = Array.isArray(mailData.to)
            ? String(mailData.to[0] ?? '')
            : String(mailData.recipientEmail ?? mailData.to ?? '');
          const contentHash = await computeContentHash(
            String((mailData.message as Record<string, unknown> | undefined)?.contentText ?? '')
          );
          txHash = await certificarEnvio(messageId, decoded.uid, toEmail, contentHash);
          break;
        }

        if (type === 'receive') {
          if (!isMailRecipientForCertify(mailData, decoded)) {
            return NextResponse.json(
              { error: 'No autorizado para certificar la recepción' },
              { status: 403 }
            );
          }
          const recipientId = recipientIdentifierForPolygon(mailData);
          txHash = await certificarRecepcion(messageId, recipientId);
          break;
        }

        // read
        if (!userHasMailDocumentAccess(mailData, decoded)) {
          return NextResponse.json({ error: 'No autorizado para certificar la lectura' }, { status: 403 });
        }
        const recipientId = recipientIdentifierForPolygon(mailData);
        txHash = await certificarLectura(messageId, recipientId);
        break;
      }

      case 'user': {
        const email = decoded.email;
        if (!email) {
          return NextResponse.json(
            { error: 'El token no incluye email; no se puede certificar el usuario' },
            { status: 400 }
          );
        }
        txHash = await certificarUsuario(decoded.uid, email);
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Tipo inválido. Usar: send, read, receive, user' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://polygonscan.com/tx/${txHash}`,
    });
  } catch (error: any) {
    console.error('❌ Error al certificar en Polygon:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al certificar en Polygon' },
      { status: 500 }
    );
  }
}
