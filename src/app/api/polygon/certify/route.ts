import { NextRequest, NextResponse } from 'next/server';
import { certificarLectura, certificarEnvio, certificarRecepcion, certificarUsuario } from '@/lib/certification';

export async function POST(request: NextRequest) {
  try {
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
        txHash = await certificarLectura(body.messageId || 'msg-123', body.userId || 'user-abc');
        break;
      case 'send':
        txHash = await certificarEnvio(
          body.messageId || 'msg-456',
          body.fromUserId || 'user-sender',
          body.toEmail || 'destino@ejemplo.com'
        );
        break;
      case 'receive':
        txHash = await certificarRecepcion(body.messageId || 'msg-789', body.userId || 'user-receiver');
        break;
      case 'user':
        txHash = await certificarUsuario(body.userId || 'user-new', body.email || 'nuevo@ejemplo.com');
        break;
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
