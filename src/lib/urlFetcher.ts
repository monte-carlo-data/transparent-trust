import { ReferenceUrl } from "@/types/referenceUrl";
import { parseApiData } from "./apiClient";

export interface FetchedUrlContent {
  url: string;
  title: string;
  content: string;
  error?: string;
}

/**
 * Fetches content from a URL and extracts text.
 * Uses a server-side API route to avoid CORS issues.
 */
export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch("/api/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch URL" }));
      throw new Error(error.error || "Failed to fetch URL");
    }

    const json = await response.json();
    const data = parseApiData<{ content?: string }>(json);
    return data.content || "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch URL";
    throw new Error(message);
  }
}

/**
 * Fetches content from multiple reference URLs in parallel.
 * Returns successfully fetched content and logs errors for failed URLs.
 */
export async function fetchMultipleUrls(
  urls: ReferenceUrl[]
): Promise<FetchedUrlContent[]> {
  const results = await Promise.allSettled(
    urls.map(async (refUrl) => {
      const content = await fetchUrlContent(refUrl.url);
      return {
        url: refUrl.url,
        title: refUrl.title || refUrl.url, // Fallback to URL if no title
        content,
      };
    })
  );

  const fetched: FetchedUrlContent[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      fetched.push(result.value);
    } else {
      console.warn(`Failed to fetch ${urls[index].url}:`, result.reason);
      fetched.push({
        url: urls[index].url,
        title: urls[index].title || urls[index].url, // Fallback to URL if no title
        content: "",
        error: result.reason?.message || "Failed to fetch",
      });
    }
  });

  return fetched;
}
