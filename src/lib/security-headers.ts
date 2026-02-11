/**
 * Security headers configuration for the application.
 * These headers are applied to all routes via next.config.ts
 */

// Content Security Policy
// Note: 'unsafe-inline' for styles is required by many UI libraries (Tailwind, Radix, etc.)
// 'unsafe-eval' is NOT included - if you see CSP errors, check for eval() usage
export const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://lh3.googleusercontent.com;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
  object-src 'none';
`;

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
];

/**
 * Required security headers that must be present.
 * Used for validation in tests.
 */
export const REQUIRED_SECURITY_HEADERS = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
] as const;

/**
 * CSP directives that must be present for security.
 */
export const REQUIRED_CSP_DIRECTIVES = [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "frame-ancestors",
  "object-src",
] as const;

/**
 * Dangerous CSP values that should NOT be present.
 */
export const FORBIDDEN_CSP_VALUES = [
  "'unsafe-eval'", // Allows eval() - XSS risk
  "data:", // In script-src - XSS risk (allowed in img-src)
] as const;

/**
 * Parse CSP string into directive map for easier testing.
 */
export function parseCSP(csp: string): Map<string, string> {
  const directives = new Map<string, string>();
  const parts = csp.split(";").map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const [directive, ...values] = part.split(/\s+/);
    if (directive) {
      directives.set(directive, values.join(" "));
    }
  }

  return directives;
}
