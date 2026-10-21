import { redirect } from 'next/navigation';
import { currentLearnerId } from '@/lib/session';

/**
 * The signed-in learner's id, or a redirect to /login.
 *
 * Server components only — a route handler cannot redirect, and should call currentLearnerId()
 * and return a 401 instead.
 *
 * Validates the Clerk session and its internal learner mapping.
 * A legacy tutor_session cookie is never accepted.
 */
export async function requireLearnerId(): Promise<string> {
  const learnerId = await currentLearnerId();
  if (!learnerId) {
    redirect('/login');
  }
  return learnerId;
}
