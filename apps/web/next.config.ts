import type { NextConfig } from 'next';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(path.resolve(process.cwd(), '../..'));
const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }] },
  async redirects() {
    return [
      {
        source: '/admin/overview',
        destination: '/admin',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/:path*` }];
  },
};
export default config;
