import type { NextConfig } from "next";

/**
 * Global security response headers applied to every route.
 *
 * Deliberate omissions:
 *  - NO X-Frame-Options / frame-ancestors: the sandbox preview panel embeds
 *    the app in an iframe and a framing restriction would break it.
 *  - NO strict CSP: Turbopack dev injects inline scripts; a strict policy
 *    would break the dev preview. `object-src 'none'` still blocks plugin
 *    embedding (the modern replacement for X-Content-Type-Options-style
 *    plugin hardening).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  // modern standard: the legacy XSS auditor is harmful, disable it
  { key: "X-XSS-Protection", value: "0" },
  { key: "Content-Security-Policy", value: "object-src 'none'" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
