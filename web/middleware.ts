import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import {
  clerkAuthorizedParties,
  clerkConfiguration,
  isNativeBearerRequest,
} from '@/lib/auth-config';

const withClerk = clerkMiddleware(
  () => {},
  (request) => ({
    publishableKey: clerkConfiguration().publishableKey,
    // Clerk reads CLERK_SECRET_KEY directly at runtime. Passing secretKey here
    // would enable dynamic-secret propagation and require a separate encryption key.
    // Clerk still verifies signature, issuer, expiry and session token type.
    // Native SDK tokens may omit azp; accept them only on explicit bearer-only APIs.
    authorizedParties: isNativeBearerRequest(request) ? undefined : clerkAuthorizedParties(),
    signInUrl: '/login',
    signUpUrl: '/register',
  })
);

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Setup and health checks work without keys; resource checks still deny access.
  if (!clerkConfiguration().configured) return NextResponse.next();
  return withClerk(request, event);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|otf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
