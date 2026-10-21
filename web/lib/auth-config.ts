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
