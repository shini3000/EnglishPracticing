import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  ChartLineUpIcon,
  ClockIcon,
  MicrophoneIcon,
  PencilLineIcon,
} from '@phosphor-icons/react/dist/ssr';
import { AppShell } from '@/components/layout/app-shell';
import type { Learner } from '@/lib/learners';

export function PracticeHome({
  learner,
  overview,
}: {
  learner: Learner;
  overview: React.ReactNode;
}) {
  const t = useTranslations('ui');

  return (
    <AppShell learner={learner} active="home">
      <header className="study-intro">
        <div>
          <p className="text-muted-foreground mb-3 text-sm">{t('mfdd4b9c19002')}</p>
          <h1 className="study-title">
            {t('m039fd08ceede')}
            <br />
            {learner.displayName}.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-lg leading-7">{t('mab5ec1d32ea9')}</p>
        </div>
        <div className="study-summary">
          <h2 className="font-semibold">{t('mf6bce1906a45')}</h2>
          {overview}
          <Link href="/progress" className="study-text-link mt-5 inline-flex items-center gap-2">
            <ChartLineUpIcon size={18} />
            {t('m3d64aae5bda7')}
          </Link>
        </div>
      </header>
      <section aria-labelledby="practice-heading" className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 id="practice-heading" className="text-xl font-semibold">
            {t('mc2b2fb8bc495')}
          </h2>
          <Link href="/call?practice=diagnostic" className="study-text-link text-sm">
            {t('mea055d773e1c')}
          </Link>
        </div>
        <div className="practice-routes">
          <article className="practice-route route-integral">
            <div className="flex items-center justify-between gap-3">
              <span className="route-letter" aria-hidden="true">
                A
              </span>
              <span className="flex items-center gap-2 text-sm">
                <ClockIcon size={18} />
                {t('maa8b04330108')}
              </span>
            </div>
            <h3>{t('m60f8ba4caeab')}</h3>
            <p>{t('m37a0828e5dae')}</p>
            <ul>
              <li>{t('m30f4620263e1')}</li>
              <li>{t('m1f367e22ed84')}</li>
              <li>{t('mc48529063243')}</li>
            </ul>
            <Link href="/call?practice=daily" className="study-button">
              <MicrophoneIcon size={18} />
              {t('m27f564332704')}
            </Link>
          </article>
          <article className="practice-route route-fluency">
            <div className="flex items-center justify-between gap-3">
              <span className="route-letter" aria-hidden="true">
                B
              </span>
              <span className="flex items-center gap-2 text-sm">
                <ClockIcon size={18} />
                {t('mdc5a474d2ccd')}
              </span>
            </div>
            <h3>{t('m754460102d8f')}</h3>
            <p>{t('m9bf68370eac6')}</p>
            <ul>
              <li>{t('m2e1328265dbb')}</li>
              <li>{t('mcc333a09d541')}</li>
              <li>{t('mef8b76b593ca')}</li>
            </ul>
            <Link href="/practice-b" className="study-button">
              {t('m2867530d3a05')}
            </Link>
            <Link href="/call?practice=fluency" className="study-text-link mt-3 text-sm">
              {t('mc6d0eca97688')}
            </Link>
          </article>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">{t('m52f6abe5af01')}</p>
      </section>
      <section className="study-bottom-grid mt-10" aria-label={t('m468d5e6461eb')}>
        <div className="quick-drill">
          <PencilLineIcon size={26} weight="duotone" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">{t('ma0495f339b70')}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{t('m39043ec72554')}</p>
            <Link href="/drill" className="study-text-link mt-4 inline-block">
              {t('m3815c1493b0f')}
            </Link>
          </div>
        </div>
        <aside className="learning-note">
          <h2 className="font-semibold">{t('m8a6c22e99648')}</h2>
          <p className="text-muted-foreground mt-3 text-sm leading-6">{t('mb19a58f44281')}</p>
        </aside>
      </section>
    </AppShell>
  );
}
