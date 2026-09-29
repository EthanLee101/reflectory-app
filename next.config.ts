import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy, currently REPORT-ONLY: browsers log violations to the
 * console but block nothing, so it can't break the deployed app. Once a full
 * click-through of the deployed site shows no violations, rename the header to
 * "Content-Security-Policy" to enforce it (see docs/production-readiness.md).
 *
 * 'unsafe-inline' is required because Next.js emits inline bootstrap scripts and
 * a nonce-based policy would force every page to render dynamically. That makes
 * this weaker against injected inline script, but it still blocks foreign
 * script/connect origins, framing, <base> hijacking and off-site form posts.
 * Fonts need no external origin: next/font self-hosts Google Fonts at build time.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: contentSecurityPolicy,
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
