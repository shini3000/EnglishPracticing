import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/layout/brand';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { Card } from '@/components/ui/card';
import { clerkConfiguration } from '@/lib/auth-config';
import { getDb } from '@/lib/db';
import { currentLearnerId } from '@/lib/session';

/**
 * /login — the only door into the app.
 *
 * Every other page redirects here when there is no session, and this one redirects away when
 * there is, so "signed in" and "looking at the login form" can never be true at once.
 */

export async function AccessPage({ register = false }: { register?: boolean }) {
  const { configured } = clerkConfiguration();
  const { userId } = configured ? await auth() : { userId: null };
  if (await currentLearnerId()) {
    redirect('/home');
  }

  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center px-5 py-16">
      <div className="login-layout">
        <div className="max-w-lg">
          <Brand size="lg" />
          <h1 className="study-title mt-10">
            El inglés se entrena.
            <br />
            Un día a la vez.
          </h1>
          <p className="text-muted-foreground mt-6 leading-7">
            Conversaciones con un propósito, correcciones por escrito y un progreso que se construye
            al volver a practicar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="bg-secondary rounded-lg px-3 py-2">Práctica integral</span>
            <span className="bg-secondary rounded-lg px-3 py-2">Fluidez</span>
            <span className="bg-secondary rounded-lg px-3 py-2">Correcciones escritas</span>
          </div>
        </div>
        <div>
          <Card className="rounded-3xl p-6 shadow-none sm:p-8">
            <h2 className="text-xl font-semibold">
              {register ? 'Crea tu cuenta' : 'Entra a tu espacio'}
            </h2>
            <p className="text-muted-foreground mb-6 text-sm leading-6">
              Tu cuenta conserva tus prácticas y tu progreso, también en otros dispositivos.
            </p>
            {!configured ? (
              <p role="status" className="text-muted-foreground text-sm leading-6">
                El acceso aún no está configurado. El administrador debe añadir las claves de Clerk.
              </p>
            ) : userId ? (
              <div className="space-y-4">
                <p role="status" className="text-sm leading-6">
                  {!getDb()
                    ? 'Falta configurar la base de datos. Contacta al administrador para guardar tus prácticas.'
                    : 'No se pudo preparar tu perfil. Contacta al administrador.'}
                </p>
                <SignOutButton />
              </div>
            ) : (
              <LoginForm register={register} />
            )}
          </Card>
          <p className="text-muted-foreground mt-6 text-center text-xs leading-5 text-balance">
            Crea tu cuenta y empieza a practicar. Tu historial y tus estadísticas son personales.
          </p>
        </div>
      </div>
    </main>
  );
}
