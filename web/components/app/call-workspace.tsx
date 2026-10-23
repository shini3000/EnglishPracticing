import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import styles from './call-workspace.module.css';

/** The live call and corrections share one layout, not independent floating panels. */
export function CallWorkspace({
  session,
  controls,
  corrections,
  navigation,
}: {
  session: ReactNode;
  controls: ReactNode;
  corrections: ReactNode;
  navigation?: ReactNode;
}) {
  const t = useTranslations('ui');

  return (
    <>
      {navigation}
      <div className={styles.layout} data-call-layout="split">
        <div className={styles.left}>
          <section className={styles.session} aria-label={t('m34ad7592d5ad')}>
            {session}
          </section>
          <div className={styles.controls}>{controls}</div>
        </div>
        <div className={styles.corrections}>{corrections}</div>
      </div>
    </>
  );
}
