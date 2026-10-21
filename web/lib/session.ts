import { cache } from 'react';
import { timingSafeEqual } from 'crypto';
import { auth, currentUser } from '@clerk/nextjs/server';
import { clerkConfiguration } from '@/lib/auth-config';
import { getDb } from '@/lib/db';
import { resolveClerkLearner } from '@/lib/learners';

/** Identity AND authorization are checked on the server for protected resources. */
export const currentLearnerId = cache(async (): Promise<string | null> => {
  if (!clerkConfiguration().configured) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const sql = getDb();
  if (!sql) return null;
  return resolveClerkLearner(sql, userId, async () => {
    // Profile lookup only on first visit. Never match by email or display name.
    const user = await currentUser();
    if (!user || user.id !== userId) throw new Error('Clerk profile unavailable');
    return user.fullName || user.firstName || user.username || 'Estudiante';
  });
});

/** Separate permission for metered photo avatars; NOT authentication. */
export function avatarPasscodeMatches(input: string): boolean {
  const expected = process.env.AVATAR_PASSCODE;
  if (!expected) throw new Error('AVATAR_PASSCODE is not set');
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
