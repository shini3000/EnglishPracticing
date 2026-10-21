import { NextResponse } from 'next/server';

/** Legacy clients cannot mint shared-passcode sessions after migration. */
export async function POST() {
  return NextResponse.json(
    { error: 'El acceso ahora se realiza con Clerk en /login.' },
    { status: 410 }
  );
}
