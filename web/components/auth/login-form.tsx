'use client';

import { SignIn, SignUp } from '@clerk/nextjs';

/** Hash routing keeps Clerk callback steps inside /login and /register. */
export function LoginForm({ register = false }: { register?: boolean }) {
  const appearance = {
    elements: {
      rootBox: 'w-full',
      cardBox: 'w-full shadow-none',
      card: 'bg-transparent shadow-none',
    },
  };
  return register ? (
    <SignUp routing="hash" signInUrl="/login" forceRedirectUrl="/home" appearance={appearance} />
  ) : (
    <SignIn routing="hash" signUpUrl="/register" forceRedirectUrl="/home" appearance={appearance} />
  );
}
