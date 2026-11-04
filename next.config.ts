import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Brotli/gzip compression for all responses – reduces ~70% size on slow mobile
  compress: true,

  async headers() {
    const rules = [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=self, microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      // Service worker must always revalidate
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];

    if (!isDev) {
      // Only set 1-year immutable cache in production builds
      rules.push({
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      });
    } else {
      // In development on localhost, purge any previously cached immutable chunks
      rules.push({
        source: '/admin-preview',
        headers: [
          { key: 'Clear-Site-Data', value: '"cache"' },
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      });
    }

    return rules;
  },
};

export default nextConfig;
