import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone tracing creates symlinks on Windows. Keep normal local builds
  // unchanged; Linux CI and the Docker builder explicitly enable this output.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
};

export default nextConfig;
