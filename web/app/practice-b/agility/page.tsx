import { headers } from 'next/headers';
import { AgilityDrill } from '@/components/practice/agility-drill';
import { requireLearnerId } from '@/lib/guard';
import { getAppConfig } from '@/lib/utils';

export default async function AgilityPage() {
  await requireLearnerId();
  const config = await getAppConfig(await headers());
  return <AgilityDrill agentName={config.agentName} />;
}
