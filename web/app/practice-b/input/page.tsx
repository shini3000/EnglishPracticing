import { InputReplica } from '@/components/practice/input-replica';
import { requireLearnerId } from '@/lib/guard';

export default async function InputPage() {
  await requireLearnerId();
  return <InputReplica />;
}
