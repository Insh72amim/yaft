import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@yaft/shared'],
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
export default nextConfig;
