import { NextResponse } from 'next/server';

// Deshabilitado: expone información de variables de entorno sin autenticación.
export function GET() {
  return NextResponse.json({ error: 'Endpoint deshabilitado.' }, { status: 410 });
}
