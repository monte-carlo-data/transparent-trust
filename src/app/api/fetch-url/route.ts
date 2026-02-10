import { NextRequest } from "next/server";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

export const maxDuration = 30;

type FetchUrlRequest = {
  url?: string;
};

/**
 * Server-side URL fetcher to avoid CORS issues.
 * Fetches a URL and extracts readable text content.
 * Protected against SSRF attacks.
 */
export async function POST(request: NextRequest) {
  let body: FetchUrlRequest;
  try {
    body = await request.json();
  } catch {
    return errors.badRequest("Invalid JSON body");
  }

  const url = body.url?.trim();
  if (!url) {
    return errors.badRequest("URL is required");
  }

  // Validate URL for SSRF vulnerabilities
  const ssrfCheck = await validateUrlForSSRF(url);
  if (!ssrfCheck.valid) {
    return errors.badRequest(ssrfCheck.error || "URL validation failed");
  }

  try {
    // Build a safe URL from the validated result to prevent DNS rebinding.
    // The SSRF validation already resolved the hostname to an IP and verified
    // it is not internal. We fetch using that resolved IP with the original
    // Host header so TLS and virtual-hosting still work.
    const validatedUrl = new URL(url);
    const originalHost = validatedUrl.hostname;
    if (ssrfCheck.resolvedIp) {
      validatedUrl.hostname = ssrfCheck.resolvedIp;
    }

    const response = await fetch(validatedUrl.toString(), {
      headers: {
        "User-Agent": "GRC-Minion/1.0 (Security Questionnaire Assistant)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Host": originalHost,
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      return errors.badGateway(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    // If HTML, extract text content
    let content = text;
    if (contentType.includes("text/html")) {
      content = extractTextFromHtml(text);
    }

    // Truncate if too long (keep under ~50k chars to avoid token limits)
    const maxLength = 50000;
    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + "\n\n[Content truncated...]";
    }

    return apiSuccess({ content, url });
  } catch (error) {
    logger.error("Error fetching URL", error, { route: "/api/fetch-url" });
    const message = error instanceof Error ? error.message : "Failed to fetch URL";
    return errors.badGateway(message);
  }
}

/**
 * Basic HTML to text extraction.
 * Removes scripts, styles, and HTML tags, preserves meaningful whitespace.
 */
function extractTextFromHtml(html: string): string {
  // Strip all HTML tags to get plain text. This is safe because we remove
  // every tag rather than trying to selectively filter dangerous ones.
  let text = html;

  // Replace common block elements with newlines first
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article|header|footer)\b[^>]*>/gi, "\n")
    .replace(/<\/?(ul|ol|table|thead|tbody)\b[^>]*>/gi, "\n");

  // Remove ALL remaining HTML tags (handles any tag including script/style)
  text = text.replace(/<[^>]*>/g, " ");

  // Decode HTML entities - decode &amp; LAST to prevent double-unescaping.
  // For example, "&amp;lt;" should become "&lt;" not "<".
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&hellip;/g, "\u2026")
    .replace(/&copy;/g, "\u00A9")
    .replace(/&reg;/g, "\u00AE")
    .replace(/&trade;/g, "\u2122")
    .replace(/&bull;/g, "\u2022")
    .replace(/&amp;/g, "&");

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
