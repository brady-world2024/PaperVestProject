import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@papervest/api-client',
    '@papervest/design-tokens',
    '@papervest/shared-types',
    '@papervest/validation',
  ],
};

export default nextConfig;
