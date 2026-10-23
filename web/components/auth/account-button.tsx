'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/ssr';
import {
  AccountPreferences,
  type AccountPreferencesLabels,
} from '@/components/profile/account-preferences';

/** Clerk owns profile details, verified email addresses and session management. */
export function AccountButton({ labels }: { labels: AccountPreferencesLabels }) {
  const { user } = useUser();
  return (
    <UserButton appearance={{ elements: { userButtonAvatarBox: 'size-8' } }}>
      <UserButton.MenuItems>
        <UserButton.Action label="manageAccount" />
        <UserButton.Action
          label={labels.menu}
          labelIcon={<SlidersHorizontalIcon size={16} />}
          open="preferences"
        />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
      <UserButton.UserProfilePage
        label={labels.menu}
        url="preferences"
        labelIcon={<SlidersHorizontalIcon size={16} />}
      >
        <AccountPreferences key={user?.id} labels={labels} />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}
