import { headers } from 'next/headers';
import { TimeShiftingDrill } from '@/components/practice/time-shifting-drill';
import { requireLearnerId } from '@/lib/guard';
import { getAppConfig } from '@/lib/utils';

export default async function DrillPage() {
  await requireLearnerId();
  const config = await getAppConfig(await headers());
  return <TimeShiftingDrill agentName={config.agentName} />;
}
