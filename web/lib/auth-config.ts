/** Server runtime configuration: identity keys are not baked into Docker images. */
export function clerkConfiguration() {
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY?.trim() || '';
  const secretKey = process.env.CLERK_SECRET_KEY?.trim() || '';
  return { publishableKey, configured: !!publishableKey && !!secretKey };
}

export function clerkAuthorizedParties(): string[] {
  const origins = (process.env.CLERK_AUTHORIZED_PARTIES || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length ? origins : ['http://localhost:3000'];
}

/** Native clients have no browser azp claim. Never apply this exception to cookies. */
export function isNativeBearerRequest(request?: Request): boolean {
  if (!request || typeof request.url !== 'string' || !request.headers) return false;
  if (request.headers.has('origin') || request.headers.has('cookie')) return false;
  if (
    !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
      request.headers.get('authorization') || ''
    )
  )
    return false;
  const path = new URL(request.url).pathname;
  return (
    (request.method === 'POST' && ['/api/token', '/api/time-shifting'].includes(path)) ||
    (request.method === 'PATCH' && path === '/api/profile') ||
    (request.method === 'GET' &&
      ['/api/profile', '/api/progress', '/api/practice-journal', '/api/mobile-progress'].includes(
        path
      ))
  );
}
