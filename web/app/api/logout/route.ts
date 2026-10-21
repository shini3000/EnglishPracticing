import { NextResponse } from 'next/server';

/** Clerk must revoke its session, not just delete the obsolete local cookie. */
export async function POST() {
  return NextResponse.json(
    { error: 'Usa Cerrar sesión para finalizar tu sesión de Clerk.' },
    { status: 410 }
  );
}
