import { URL } from "url";
import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

/**
 * SSRF Protection Utility
 * Validates URLs before server-side fetching to prevent Server-Side Request Forgery attacks.
 */

// Private/internal IP ranges that should never be fetched
const BLOCKED_IP_RANGES = [
  // Localhost
  /^127\./,
  /^0\./,
  // Private networks (RFC 1918)
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  // Loopback IPv6
  /^::1$/,
  /^0:0:0:0:0:0:0:1$/,
  // IPv6 private ranges
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
];

// Cloud metadata endpoints
const BLOCKED_HOSTNAMES = [
  "metadata.google.internal",
  "metadata.gcp.internal",
  "169.254.169.254", // AWS/GCP/Azure metadata
  "169.254.170.2", // AWS ECS metadata
  "fd00:ec2::254", // AWS IPv6 metadata
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "kubernetes.default",
  "kubernetes.default.svc",
];

export type SSRFValidationResult = {
  valid: boolean;
  error?: string;
  resolvedIp?: string;
  originalHostname?: string;
  /** Safe URL string with hostname replaced by resolved IP. Use this for fetch calls. */
  safeUrl?: string;
};

/**
 * Check if an IP address is in a blocked range
 */
function isBlockedIp(ip: string): boolean {
  return BLOCKED_IP_RANGES.some((pattern) => pattern.test(ip));
}

/**
 * Check if a hostname is blocked
 */
function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some(
    (blocked) => normalized === blocked || normalized.endsWith("." + blocked)
  );
}

/**
 * Validate a URL for SSRF vulnerabilities
 * This performs:
 * 1. Scheme validation (only http/https)
 * 2. Hostname blocklist check
 * 3. DNS resolution to catch hostname -> private IP tricks
 */
export async function validateUrlForSSRF(
  urlString: string
): Promise<SSRFValidationResult> {
  let parsed: URL;

  // Parse URL
  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check scheme - only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: `Only HTTP and HTTPS URLs are allowed` };
  }

  // Check for credentials in URL (potential for request splitting)
  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  const hostname = parsed.hostname;

  // Check blocklist
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: `Blocked hostname: ${hostname}` };
  }

  // Extract validated components for building safe URL
  const protocol = parsed.protocol; // already validated as http: or https:
  const port = parsed.port;
  const pathname = parsed.pathname;
  const search = parsed.search;
  const hash = parsed.hash;

  // Check if hostname is already an IP
  if (/^[\d.]+$/.test(hostname) || hostname.startsWith("[")) {
    // IPv4 or IPv6 literal
    const ip = hostname.replace(/^\[|\]$/g, ""); // Remove brackets from IPv6
    if (isBlockedIp(ip)) {
      return { valid: false, error: `Blocked IP address: ${ip}` };
    }
    const portSuffix = port ? `:${port}` : "";
    return {
      valid: true,
      resolvedIp: ip,
      originalHostname: hostname,
      safeUrl: `${protocol}//${hostname}${portSuffix}${pathname}${search}${hash}`,
    };
  }

  // DNS resolution check - catch domain -> private IP attacks
  try {
    const { address } = await dnsLookup(hostname);
    if (isBlockedIp(address)) {
      return {
        valid: false,
        error: `Hostname resolves to blocked IP: ${address}`,
      };
    }
    // Build safe URL from scratch using resolved IP (not derived from user input)
    const portSuffix = port ? `:${port}` : "";
    const safeUrl = `${protocol}//${address}${portSuffix}${pathname}${search}${hash}`;
    return { valid: true, resolvedIp: address, originalHostname: hostname, safeUrl };
  } catch {
    // DNS resolution failed - reject the request to prevent DNS rebinding attacks
    // An attacker could use a domain that fails initial DNS but resolves later to an internal IP
    return { valid: false, error: "DNS resolution failed for hostname" };
  }
}

/**
 * Validate a URL and fetch it safely, preventing SSRF attacks.
 * All validation and URL construction is inlined so that static analysis
 * can verify the fetch target is safe without cross-function taint propagation.
 */
export async function safeFetch(
  urlString: string,
  init?: RequestInit
): Promise<{ response: Response; originalHostname: string }> {
  // --- inline validation (mirrors validateUrlForSSRF) ---
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with credentials are not allowed");
  }

  const hostname = parsed.hostname;
  if (isBlockedHostname(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  let resolvedHost: string;

  if (/^[\d.]+$/.test(hostname) || hostname.startsWith("[")) {
    const ip = hostname.replace(/^\[|\]$/g, "");
    if (isBlockedIp(ip)) {
      throw new Error(`Blocked IP address: ${ip}`);
    }
    resolvedHost = hostname;
  } else {
    let address: string;
    try {
      const lookup = await dnsLookup(hostname);
      address = lookup.address;
    } catch {
      throw new Error("DNS resolution failed for hostname");
    }
    if (isBlockedIp(address)) {
      throw new Error(`Hostname resolves to blocked IP: ${address}`);
    }
    resolvedHost = address;
  }

  // Build fetch URL from validated components
  const port = parsed.port ? `:${parsed.port}` : "";
  const target = `${parsed.protocol}//${resolvedHost}${port}${parsed.pathname}${parsed.search}${parsed.hash}`;

  const response = await fetch(target, {
    ...init,
    headers: {
      ...init?.headers,
      Host: hostname,
    },
  });
  return { response, originalHostname: hostname };
}

/**
 * Synchronous URL validation (hostname/scheme only, no DNS check)
 * Use this for quick pre-validation before async validation
 */
export function quickValidateUrl(urlString: string): SSRFValidationResult {
  let parsed: URL;

  try {
    parsed = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check scheme - only allow HTTP and HTTPS
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: `Only HTTP and HTTPS URLs are allowed` };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: "URLs with credentials are not allowed" };
  }

  const hostname = parsed.hostname;

  if (isBlockedHostname(hostname)) {
    return { valid: false, error: `Blocked hostname: ${hostname}` };
  }

  // Check if hostname is an IP literal
  if (/^[\d.]+$/.test(hostname) || hostname.startsWith("[")) {
    const ip = hostname.replace(/^\[|\]$/g, "");
    if (isBlockedIp(ip)) {
      return { valid: false, error: `Blocked IP address: ${ip}` };
    }
  }

  return { valid: true };
}
