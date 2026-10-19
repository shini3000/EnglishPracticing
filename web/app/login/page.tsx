import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Brand } from '@/components/layout/brand';
import { Card } from '@/components/ui/card';
import { currentLearnerId } from '@/lib/session';

/**
 * /login — the only door into the app.
 *
 * Every other page redirects here when there is no session, and this one redirects away when
 * there is, so "signed in" and "looking at the login form" can never be true at once.
 */

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
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
            <span className="bg-secondary rounded-lg px-3 py-2">Ejercicios sin llamada</span>
          </div>
        </div>
        <div>
          <Card className="rounded-3xl p-6 shadow-none sm:p-8">
            <h2 className="text-xl font-semibold">Entra a tu espacio</h2>
            <p className="text-muted-foreground mb-6 text-sm leading-6">
              Usa el mismo nombre para recuperar tu progreso.
            </p>
            <LoginForm />
          </Card>
          <p className="text-muted-foreground mt-6 text-center text-xs leading-5 text-balance">
            Si es tu primera vez, elige un nombre de usuario. Tu perfil se crea al entrar con la
            clave de acceso del proyecto.
          </p>
        </div>
      </div>
    </main>
  );
}
