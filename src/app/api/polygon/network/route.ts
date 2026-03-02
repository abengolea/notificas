import { NextResponse } from 'next/server';
import { getNetworkInfo, getWalletBalance, getWalletAddress } from '@/lib/blockchain';

export async function GET() {
  try {
    const networkInfo = await getNetworkInfo();
    const walletAddress = getWalletAddress();
    let balance = 'N/A';
    try {
      balance = `${await getWalletBalance()} POL`;
    } catch {
      balance = 'Wallet no configurada';
    }

    return NextResponse.json({
      success: true,
      data: {
        ...networkInfo,
        balance,
        walletAddress: walletAddress || null,
      },
    });
  } catch (error: any) {
    console.error('❌ Error al obtener info de red:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al obtener información de red' },
      { status: 500 }
    );
  }
}
