// ============================================================
// Security Headers Middleware
//
// Applied to every HTTP response. Defense-in-depth headers
// that protect against XSS, clickjacking, MIME sniffing, etc.
// ============================================================

import type { IncomingMessage, ServerResponse } from "http";

export function applySecurityHeaders(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy — don't leak URLs
  res.setHeader("Referrer-Policy", "no-referrer");

  // Permissions policy — disable unnecessary APIs
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), payment=(), usb=()"
  );

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js needs these in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",        // allow base64 images
      "media-src 'self' data: blob:",      // allow base64 audio
      "connect-src 'self' ws: wss:",       // allow WebSocket
      "font-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Strict Transport Security (when behind HTTPS)
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // Don't expose server info
  res.removeHeader("X-Powered-By");
}
