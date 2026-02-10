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
    // Use resolved IP to prevent DNS rebinding attacks
    let fetchUrl = url;
    if (ssrfCheck.resolvedIp && ssrfCheck.originalHostname) {
      const parsedUrl = new URL(url);
      fetchUrl = url.replace(parsedUrl.hostname, ssrfCheck.resolvedIp);
    }

    const parsedUrl = new URL(url);
    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "GRC-Minion/1.0 (Security Questionnaire Assistant)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Host": parsedUrl.hostname,
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
  // Remove script and style elements
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  // Replace common block elements with newlines
  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article|header|footer)[^>]*>/gi, "\n")
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, "\n");

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    .replace(/&bull;/g, "•")
    // Decode numeric entities (decimal: &#123; and hex: &#x7B;)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Clean up whitespace
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}
