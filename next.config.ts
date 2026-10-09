import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const isDev = process.env.NODE_ENV === "development";

/* Content Security Policy, the "without nonces" kind from Next's CSP guide:
 * the pages are prerendered, so there is no per-request nonce and Next's
 * inline scripts must stay allowed. React's escaping is what keeps injected
 * script out; this narrows what a bug could still do. The browser may only
 * talk to this site and the Drive API (the only place the Google access
 * token is sent), show images from the poster CDNs and Google avatars, and
 * never be framed by another site. Add a host here when the app starts
 * calling or loading from a new one, or it will be blocked. */
const IMAGE_HOSTS =
  "https://s4.anilist.co https://image.tmdb.org https://*.googleusercontent.com";
const DRIVE_API = "https://www.googleapis.com";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMAGE_HOSTS}`,
  "font-src 'self' data:",
  `connect-src 'self' ${DRIVE_API}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Older browsers' version of frame-ancestors 'none' (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Sign-in is a full-page redirect, not a popup, so nothing needs opener.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HTTPS only from now on (ignored over plain http, e.g. localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

/* The service worker's own policy. Posters, avatars and Drive calls pass
 * through it (sw.ts), and inside a worker every fetch counts as connect-src,
 * not img-src, so it must be allowed to reach the image hosts too. With the
 * pages' policy, every poster failed once the worker took over. */
const swCsp = [
  "default-src 'self'",
  "script-src 'self'",
  `connect-src 'self' ${DRIVE_API} ${IMAGE_HOSTS}`,
].join("; ");

const nextConfig: NextConfig = {
  // Don't advertise the framework in every response.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Later entries override the same header for matching paths.
      {
        source: "/serwist/:path*",
        headers: [{ key: "Content-Security-Policy", value: swCsp }],
      },
    ];
  },
};

// Keeps esbuild (which compiles the service worker) out of the server bundle.
export default withSerwist(nextConfig);
