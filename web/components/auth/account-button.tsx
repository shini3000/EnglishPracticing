'use client';

import { UserButton } from '@clerk/nextjs';

/** Clerk owns profile details, verified email addresses and session management. */
export function AccountButton() {
  return <UserButton appearance={{ elements: { userButtonAvatarBox: 'size-8' } }} />;
}
