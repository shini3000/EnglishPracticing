import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AccountButton } from '@/components/auth/account-button';
import { Brand } from '@/components/layout/brand';
import { SignOutButton } from '@/components/layout/sign-out-button';
import { translateStatic } from '@/i18n/static-text';
import type { Learner } from '@/lib/learners';
import { cn } from '@/lib/shadcn/utils';

/**
 * The frame around every signed-in page: header, navigation, and the content column.
 *
 * Pages pass which tab they are rather than the header reading the pathname. That keeps this a
 * server component — no client bundle, no hydration — and makes the highlighted tab a fact the
 * page states about itself instead of one the header infers.
 */

const TABS = [
  { key: 'home', href: '/home', label: 'Prácticas' },
  { key: 'progress', href: '/progress', label: 'Mi progreso' },
] as const;

// Keep direct /profile links compatible, without an extra navigation tab.
export type ShellTab = (typeof TABS)[number]['key'] | 'profile';

function NavTabs({ active }: { active: ShellTab }) {
  const t = useTranslations('ui');

  return (
    <nav
      aria-label={t('m781509b25aa0')}
      className="bg-muted/60 flex items-center gap-1 rounded-full p-1"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? 'page' : undefined}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
            tab.key === active
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {translateStatic(t, tab.label)}
        </Link>
      ))}
    </nav>
  );
}

/** The learner's initial in a circle. Cheap identity confirmation at a glance. */
function LearnerChip({ learner }: { learner: Learner }) {
  const t = useTranslations('ui');
  const profile = useTranslations('profile');

  return (
    <span
      className="flex items-center gap-2"
      title={t('meeac2e39320e', { v0: learner.displayName })}
    >
      <AccountButton
        labels={{
          menu: profile('menu'),
          description: profile('description'),
          loading: profile('loading'),
          loadFailed: profile('loadFailed'),
          retry: profile('retry'),
          form: {
            native: profile('native'),
            target: profile('target'),
            english: profile('english'),
            fixed: profile('fixed'),
            practice: profile('practice'),
            save: profile('save'),
            saving: profile('saving'),
            saved: profile('saved'),
            failed: profile('failed'),
            migration: profile('migration'),
          },
        }}
      />
      <span className="text-foreground hidden text-sm font-medium md:inline">
        {learner.displayName}
      </span>
    </span>
  );
}

type AppShellProps = {
  active: ShellTab;
  children: React.ReactNode;
} & ({ learner: Learner; loading?: false } | { learner?: never; loading: true });

export function AppShell({ learner, active, children, loading }: AppShellProps) {
  const t = useTranslations('ui');

  return (
    <div className="study-shell bg-background min-h-svh">
      <a href="#main-content" className="skip-link">
        {t('mfdab69210d5c')}
      </a>
      <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex min-h-20 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <Brand href="/home" />

          <div className="flex items-center gap-2 sm:gap-4">
            <NavTabs active={active} />
            <span className="bg-border hidden h-6 w-px sm:block" aria-hidden />
            {loading ? (
              <span
                aria-hidden="true"
                className="bg-muted size-8 rounded-full motion-safe:animate-pulse"
              />
            ) : (
              <>
                <LearnerChip learner={learner} />
                <SignOutButton />
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-14">
        {children}
      </main>
    </div>
  );
}
