import { NextResponse } from 'next/server';

// Deshabilitado: contenía credenciales SMTP hardcodeadas.
export function POST() {
  return NextResponse.json({ error: 'Endpoint deshabilitado.' }, { status: 410 });
}
