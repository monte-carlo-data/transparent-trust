import Anthropic from "@anthropic-ai/sdk";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";
import { logger } from "@/lib/logger";
import { getSecret } from "@/lib/secrets";

// Cache Anthropic client to avoid recreating on every request
let cachedAnthropicClient: Anthropic | null = null;

/**
 * Get an initialized Anthropic client.
 * Retrieves API key from AWS Secrets Manager or environment variable.
 * Caches the client for reuse across requests.
 *
 * @throws Error if ANTHROPIC_API_KEY is not configured
 */
export async function getAnthropicClient(): Promise<Anthropic> {
  if (cachedAnthropicClient) {
    return cachedAnthropicClient;
  }

  try {
    // Try Secrets Manager first, fall back to env var
    const apiKey = await getSecret("anthropic-api-key", "ANTHROPIC_API_KEY");
    cachedAnthropicClient = new Anthropic({ apiKey });
    return cachedAnthropicClient;
  } catch (error) {
    logger.error("Failed to initialize Anthropic client", error);
    throw new Error(
      "ANTHROPIC_API_KEY not configured. " +
      "Set it in AWS Secrets Manager (transparent-trust/prod/anthropic-api-key) " +
      "or as an environment variable."
    );
  }
}

/**
 * Parse JSON from LLM response text, stripping markdown code fences if present.
 */
export function parseJsonResponse<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const withoutFence = stripCodeFence(trimmed);

  try {
    return JSON.parse(withoutFence) as T;
  } catch {
    // Try to extract JSON object as fallback
    const match = withoutFence.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("Failed to parse LLM response as JSON");
  }
}

/**
 * Strip markdown code fences from a string.
 */
export function stripCodeFence(value: string): string {
  if (!value.startsWith("```")) {
    return value;
  }

  const lines = value.split("\n");
  if (lines.length <= 2) {
    return value;
  }

  // Remove opening fence line (e.g., ```json)
  lines.shift();

  // Remove closing fence if present
  if (lines[lines.length - 1]?.trim() === "```") {
    lines.pop();
  }

  return lines.join("\n").trim();
}

/**
 * Fetch URL content with SSRF protection and standard validation.
 * Returns null if fetch fails, content is invalid, or URL fails SSRF check.
 */
export async function fetchUrlContent(
  urlString: string,
  options: {
    maxLength?: number;
    userAgent?: string;
    timeoutMs?: number;
  } = {}
): Promise<string | null> {
  const { maxLength = 15000, userAgent = "TransparentTrust/1.0", timeoutMs = 10000 } = options;

  // SSRF protection: validate URL before fetching
  const ssrfCheck = await validateUrlForSSRF(urlString);
  if (!ssrfCheck.valid) {
    logger.warn("SSRF check failed for URL", { url: urlString, error: ssrfCheck.error });
    return null;
  }

  try {
    // Use resolved IP to prevent DNS rebinding attacks
    let fetchUrl = urlString;
    const parsedUrl = new URL(urlString);
    if (ssrfCheck.resolvedIp && ssrfCheck.originalHostname) {
      fetchUrl = urlString.replace(parsedUrl.hostname, ssrfCheck.resolvedIp);
    }

    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent": userAgent,
        "Host": parsedUrl.hostname,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      logger.warn("Failed to fetch URL", { url: urlString, status: response.statusText });
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text")) {
      logger.warn("Skipping non-text content", { url: urlString, contentType });
      return null;
    }

    const text = await response.text();
    return text.slice(0, maxLength);
  } catch (error) {
    logger.warn("Error fetching URL", error, { url: urlString });
    return null;
  }
}
