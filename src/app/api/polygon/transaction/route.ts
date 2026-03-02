import { NextRequest, NextResponse } from 'next/server';
import { getTransactionInfo } from '@/lib/blockchain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('txHash');

    if (!txHash) {
      return NextResponse.json(
        { error: 'txHash es requerido' },
        { status: 400 }
      );
    }

    const info = await getTransactionInfo(txHash);

    return NextResponse.json({
      success: true,
      data: info,
      explorerUrl: `https://polygonscan.com/tx/${txHash}`,
    });
  } catch (error: any) {
    console.error('❌ Error al obtener info de transacción:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al obtener información' },
      { status: 500 }
    );
  }
}
