import { getTranslations } from 'next-intl/server';
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
  const t = await getTranslations('ui');

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
            {t('m4fd335c027bb')}
            <br />
            {t('mb07fcc049bf0')}
          </h1>
          <p className="text-muted-foreground mt-6 leading-7">{t('ma9452de15fb0')}</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="bg-secondary rounded-lg px-3 py-2">{t('mdc00cc28b799')}</span>
            <span className="bg-secondary rounded-lg px-3 py-2">{t('m6c5901b8fe67')}</span>
            <span className="bg-secondary rounded-lg px-3 py-2">{t('m519c4ac8a3e1')}</span>
          </div>
        </div>
        <div>
          <Card className="rounded-3xl p-6 shadow-none sm:p-8">
            <h2 className="text-xl font-semibold">
              {register ? t('m1dfb6ce20ad2') : t('m8974c91ec523')}
            </h2>
            <p className="text-muted-foreground mb-6 text-sm leading-6">{t('mcc88562791b7')}</p>
            {!configured ? (
              <p role="status" className="text-muted-foreground text-sm leading-6">
                {t('m094a627a04a2')}
              </p>
            ) : userId ? (
              <div className="space-y-4">
                <p role="status" className="text-sm leading-6">
                  {!getDb() ? t('m3276b5a4115e') : t('m4559369e5e99')}
                </p>
                <SignOutButton />
              </div>
            ) : (
              <LoginForm register={register} />
            )}
          </Card>
          <p className="text-muted-foreground mt-6 text-center text-xs leading-5 text-balance">
            {t('mba49a14bff37')}
          </p>
        </div>
      </div>
    </main>
  );
}
