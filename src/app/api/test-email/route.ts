import { NextResponse } from 'next/server';

/**
 * Este endpoint fue deshabilitado por razones de seguridad:
 * - Contenía credenciales SMTP hardcodeadas en el código fuente
 * - No requería autenticación
 *
 * Para enviar emails de prueba, usar el endpoint /api/sendEmail autenticado.
 */
export function POST() {
  return NextResponse.json(
    { error: 'Endpoint deshabilitado. Usar /api/sendEmail.' },
    { status: 410 }
  );
}
