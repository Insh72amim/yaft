import type { NextConfig } from 'next';
import path from 'path';

const isDemoExport = process.env.NEXT_PUBLIC_DEMO_EXPORT === 'true';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@yaft/shared'],
  distDir: isDemoExport
    ? '.next-demo'
    : process.env.NODE_ENV === 'development'
    ? '.next-dev'
    : '.next',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  ...(isDemoExport
    ? {
        output: 'export',
        basePath: '/demo',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
              ],
            },
          ];
        },
      }),
};
export default nextConfig;
