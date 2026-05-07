import { NextResponse } from 'next/server';

/**
 * Endpoint deshabilitado.
 *
 * Este endpoint eliminaba documentos de Firestore usando criterios hardcodeados
 * con un email de desarrollo, sin ninguna autenticación. Era accesible
 * públicamente y potencialmente destructivo para datos de producción.
 *
 * La limpieza de datos debe hacerse de forma controlada desde Firebase Console
 * o a través de un script autenticado con permisos de administrador.
 */
export function POST() {
  return NextResponse.json(
    { error: 'Endpoint deshabilitado.' },
    { status: 410 }
  );
}
