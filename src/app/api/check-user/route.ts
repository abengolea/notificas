import { NextResponse } from 'next/server';

/**
 * Este endpoint fue deshabilitado por razones de seguridad:
 * - Creaba usuarios sin verificar autenticación
 * - Usaba un email hardcodeado para todos los usuarios
 * - Otorgaba créditos gratis sin verificación
 *
 * La creación de usuarios debe hacerse autenticada, usando los datos
 * del token de Firebase (uid y email) via firebase-admin.
 */
export function GET() {
  return NextResponse.json(
    { error: 'Endpoint deshabilitado. La gestión de usuarios se realiza vía autenticación.' },
    { status: 410 }
  );
}
