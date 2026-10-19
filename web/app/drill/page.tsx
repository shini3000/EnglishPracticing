import { TimeShiftingDrill } from '@/components/practice/time-shifting-drill';
import { requireLearnerId } from '@/lib/guard';

export default async function DrillPage() {
  await requireLearnerId();
  return <TimeShiftingDrill />;
}
