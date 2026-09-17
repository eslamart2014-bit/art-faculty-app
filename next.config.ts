import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LOW-1 FIX: Add security headers to all responses
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking (embedding in iframes)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Prevent MIME-type sniffing attacks
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Enable XSS protection in older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Restrict powerful features
          {
            key: "Permissions-Policy",
            value: "camera=self, microphone=(), geolocation=()"
          },
          // Enforce HTTPS
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
