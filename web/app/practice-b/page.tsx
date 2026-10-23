import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FluencyBlocks } from '@/components/practice/fluency-blocks';
import { requireLearnerId } from '@/lib/guard';

export default async function PracticeBPage() {
  const t = await getTranslations('ui');

  await requireLearnerId();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/home" className="study-text-link text-sm">
        {t('m23e939f389fb')}
      </Link>
      <h1 className="study-title mt-8">{t('m754460102d8f')}</h1>
      <p className="mt-6 leading-7">{t('mab1ac28f4177')}</p>
      <FluencyBlocks variant="cards" />
      <p className="text-muted-foreground text-sm">{t('m2d9f49f696b1')}</p>
    </main>
  );
}
