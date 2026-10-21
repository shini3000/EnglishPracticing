import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { clerkAuthorizedParties, clerkConfiguration } from '@/lib/auth-config';

const withClerk = clerkMiddleware(
  () => {},
  () => ({
    publishableKey: clerkConfiguration().publishableKey,
    // Clerk reads CLERK_SECRET_KEY directly at runtime. Passing secretKey here
    // would enable dynamic-secret propagation and require a separate encryption key.
    authorizedParties: clerkAuthorizedParties(),
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
