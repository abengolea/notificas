import { NextResponse } from 'next/server';

// Deshabilitado: endpoint de testing sin uso en producción.
export function GET() {
  return NextResponse.json({ error: 'Endpoint deshabilitado.' }, { status: 410 });
}
export function POST() {
  return NextResponse.json({ error: 'Endpoint deshabilitado.' }, { status: 410 });
}
