/**
 * V2 Chat API Route
 *
 * Chat endpoint that uses BuildingBlocks for context.
 * Supports streaming responses and conversation history.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-v2";
import type { TracingOptions } from "@/lib/llm";
import { executeLLMCall } from "@/lib/llm/registry";
import { checkRateLimit, getRateLimitIdentifier } from "@/lib/rateLimit";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import { getActiveBlocksForContext } from "@/lib/v2/blocks";
import type { LibraryId } from "@/types/v2";
import { toTypedBlock } from "@/types/v2";
import prisma from "@/lib/prisma";
import { validateUrlForSSRF } from "@/lib/ssrfProtection";

export const maxDuration = 120;

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  libraries: z.array(z.string()).default(["knowledge"]),
  categories: z.array(z.string()).optional(),
  modelSpeed: z.enum(["fast", "quality"]).default("quality"),
  callMode: z.boolean().optional().default(false),
  webSearch: z.boolean().optional().default(false),
  userInstructions: z.string().optional(),
  blockIds: z.array(z.string()).optional().default([]),
  stagedSourceIds: z.array(z.string()).optional().default([]),
  customerId: z.string().optional(),
});

type WebSearchResult = {
  url: string;
  title: string;
  snippet?: string;
  content: string;
};

const MAX_WEB_SOURCES = 3;
const MAX_WEB_CONTENT_LENGTH = 50000;

async function fetchWebSearchResults(query: string): Promise<WebSearchResult[]> {
  const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent": "TransparentTrust/1.0 (Web Search)",
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    Heading?: string;
    AbstractURL?: string;
    AbstractText?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
  };

  const candidates: Array<{ url: string; title: string; snippet?: string }> = [];

  if (data.AbstractURL) {
    candidates.push({
      url: data.AbstractURL,
      title: data.Heading || data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  const collectTopics = (
    topics: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }> = []
  ) => {
    topics.forEach((topic) => {
      if (topic.FirstURL && topic.Text) {
        candidates.push({
          url: topic.FirstURL,
          title: topic.Text,
        });
      }
      if (topic.Topics?.length) {
        collectTopics(topic.Topics);
      }
    });
  };

  if (data.RelatedTopics?.length) {
    collectTopics(data.RelatedTopics);
  }

  const deduped = Array.from(
    new Map(candidates.map((item) => [item.url, item])).values()
  ).slice(0, MAX_WEB_SOURCES);

  const results: WebSearchResult[] = [];

  for (const candidate of deduped) {
    const validation = await validateUrlForSSRF(candidate.url);
    if (!validation.valid) {
      continue;
    }

    try {
      // Use resolved IP to prevent DNS rebinding attacks
      let fetchUrl = candidate.url;
      const parsedUrl = new URL(candidate.url);
      if (validation.resolvedIp && validation.originalHostname) {
        fetchUrl = candidate.url.replace(parsedUrl.hostname, validation.resolvedIp);
      }

      const contentResponse = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "TransparentTrust/1.0 (Web Search)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
          "Host": parsedUrl.hostname,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!contentResponse.ok) {
        continue;
      }

      const contentType = contentResponse.headers.get("content-type") || "";
      const rawContent = await contentResponse.text();
      let content = rawContent;

      if (contentType.includes("text/html")) {
        content = extractTextFromHtml(rawContent);
      }

      if (content.length > MAX_WEB_CONTENT_LENGTH) {
        content = `${content.slice(0, MAX_WEB_CONTENT_LENGTH)}\n\n[Content truncated...]`;
      }

      if (!content.trim()) {
        continue;
      }

      results.push({
        url: candidate.url,
        title: candidate.title,
        snippet: candidate.snippet,
        content,
      });
    } catch {
      // Skip failed fetches
    }
  }

  return results;
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

  text = text
    .replace(/<\/?(p|div|br|h[1-6]|li|tr|section|article|header|footer)[^>]*>/gi, "\n")
    .replace(/<\/?(ul|ol|table|thead|tbody)[^>]*>/gi, "\n");

  text = text.replace(/<[^>]+>/g, " ");

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
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// POST /api/v2/chat
// Send a message and get a response
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;

  // Rate limiting
  const rateLimitId = await getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(rateLimitId, "llm");
  if (!rateLimitResult.success) {
    return rateLimitResult.error || errors.internal("Rate limit check failed");
  }

  try {
    const body = await request.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return errors.badRequest(parsed.error.issues[0]?.message || "Invalid request");
    }

    const {
      message,
      sessionId,
      libraries,
      categories,
      modelSpeed,
      callMode,
      webSearch,
      userInstructions,
      blockIds,
      stagedSourceIds,
      customerId,
    } = parsed.data as {
      message: string;
      sessionId?: string;
      libraries: LibraryId[];
      categories?: string[];
      modelSpeed: "fast" | "quality";
      callMode: boolean;
      webSearch: boolean;
      userInstructions?: string;
      blockIds: string[];
      stagedSourceIds: string[];
      customerId?: string;
    };

    // Validate customer access if customerId is provided
    if (customerId) {
      if (!/^[a-z0-9]{24}$/.test(customerId)) {
        return errors.badRequest("Invalid customer ID format");
      }
      // TODO: Add canAccessCustomer check here when implementing authorization
    }

    let blocks = await getActiveBlocksForContext(libraries, {
      limit: 20,
      categories,
    });

    if (blockIds.length > 0) {
      const selectedBlocks = await prisma.buildingBlock.findMany({
        where: {
          id: { in: blockIds },
          status: "ACTIVE",
        },
      });
      const typedBlocks = selectedBlocks.map(toTypedBlock);
      const byId = new Map(typedBlocks.map((block) => [block.id, block]));
      blocks = blockIds
        .map((id) => byId.get(id))
        .filter((block): block is typeof typedBlocks[number] => Boolean(block));
    }

    // Fetch staged sources if IDs provided
    let stagedSources: Array<{ id: string; title: string; content: string | null; sourceType: string }> = [];
    if (stagedSourceIds.length > 0) {
      const sources = await prisma.stagedSource.findMany({
        where: {
          id: { in: stagedSourceIds },
          content: { not: null }, // Only include sources with content
        },
        select: {
          id: true,
          title: true,
          content: true,
          sourceType: true,
        },
      });
      stagedSources = sources;
    }

    // User instructions (presets removed - use personas instead)
    const allInstructions = userInstructions?.trim() || undefined;

    const webSearchResults = webSearch
      ? await fetchWebSearchResults(message)
      : [];
    const webSearchSkills = webSearchResults.map((result, index) => ({
      id: `web-${index + 1}`,
      title: `Web Source: ${result.title}`,
      content: result.content || result.snippet || "",
    }));

    // Convert staged sources to skills format
    const sourceSkills = stagedSources.map((source) => ({
      id: source.id,
      title: `[${source.sourceType.toUpperCase()}] ${source.title}`,
      content: source.content || "",
    }));

    // Convert blocks to skills format for LLM
    const skills = [
      ...blocks.map((block) => ({
        id: block.id,
        title: block.title,
        content: block.content,
      })),
      ...sourceSkills,
      ...webSearchSkills,
    ];

    // Set up tracing
    const tracingOptions: TracingOptions = {
      userId: userId || undefined,
      userEmail: userEmail || undefined,
    };

    // Execute via registry with runtime context
    const result = await executeLLMCall({
      question: message,
      compositionId: "chat_response",
      runtimeContext: {
        callMode,
        userInstructions: allInstructions || undefined,
      },
      skills,
      modelSpeed,
      tracingOptions,
    });

    // Create or update chat session if sessionId provided and user is authenticated
    let chatSessionId = sessionId;
    let assistantMessageId: string | undefined;
    if (userId) {
      if (sessionId) {
        // Update existing session
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: {
            updatedAt: new Date(),
          },
        }).catch(() => {
          // Session might not exist, that's ok
        });
      } else {
        // Create new session
        const newSession = await prisma.chatSession.create({
          data: {
            userId,
            title: message.slice(0, 100),
          },
        });
        chatSessionId = newSession.id;
      }

      // Store messages
      if (chatSessionId) {
        await prisma.chatMessage.createMany({
          data: [
            {
              sessionId: chatSessionId,
              role: "user",
              content: message,
            },
            {
              sessionId: chatSessionId,
              role: "assistant",
              content: result.answer,
              metadata: {
                blocksUsed: blocks.map((b) => b.id),
                sourcesUsed: stagedSources.map((s) => s.id),
                traceId: result.traceId,
                transparency: {
                  systemPrompt: result.transparency.systemPrompt,
                  compositionId: result.transparency.compositionId,
                  model: result.usage?.model || "unknown",
                  blocksUsed: blocks.map((b) => ({
                    id: b.id,
                    title: b.title,
                    content: b.content,
                    libraryId: b.libraryId,
                    blockType: b.blockType,
                    entryType: b.entryType,
                  })),
                  sourcesUsed: stagedSources.map((s) => ({
                    id: s.id,
                    title: s.title,
                    sourceType: s.sourceType,
                  })),
                },
                webSearchSources: webSearchResults.map((result) => ({
                  url: result.url,
                  title: result.title,
                  citedText: result.snippet,
                })),
              },
            },
          ],
        });
        // Get the assistant message ID
        const assistantMessage = await prisma.chatMessage.findFirst({
          where: { sessionId: chatSessionId, role: "assistant" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        assistantMessageId = assistantMessage?.id;
      }
    }

    // Track usage on blocks that were used
    if (blocks.length > 0) {
      for (const block of blocks) {
        const attrs = (block.attributes as Record<string, unknown>) || {};
        await prisma.buildingBlock.update({
          where: { id: block.id },
          data: {
            attributes: {
              ...attrs,
              usageCount: ((attrs.usageCount as number) || 0) + 1,
              lastUsedAt: new Date().toISOString(),
            },
          },
        }).catch((error) => {
          // Log but don't fail on usage tracking errors
          logger.warn("Failed to track usage for block", error, { blockId: block.id });
        });
      }
    }

    return apiSuccess({
      answer: result.answer,
      sessionId: chatSessionId,
      messageId: assistantMessageId,
      blocksUsed: blocks.map((b) => ({
        id: b.id,
        title: b.title,
        libraryId: b.libraryId,
      })),
      sourcesUsed: stagedSources.map((s) => ({
        id: s.id,
        title: s.title,
        sourceType: s.sourceType,
      })),
      webSearchSources: webSearchResults.map((result) => ({
        url: result.url,
        title: result.title,
        citedText: result.snippet,
      })),
      transparency: {
        systemPrompt: result.transparency.systemPrompt,
        compositionId: result.transparency.compositionId,
        blockIds: result.transparency.blockIds,
        runtimeBlockIds: result.transparency.runtimeBlockIds,
        runtimeContext: result.transparency.runtimeContext,
        model: result.usage?.model || "unknown",
        blocksUsed: [
          ...blocks.map((b) => ({
            id: b.id,
            title: b.title,
            content: b.content,
            libraryId: b.libraryId,
            blockType: b.blockType,
            entryType: b.entryType,
          })),
          ...stagedSources.map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content || "",
            libraryId: "source",
            blockType: "source",
            entryType: s.sourceType,
          })),
          ...webSearchResults.map((result, index) => ({
            id: `web-${index + 1}`,
            title: result.title,
            content: result.content,
            libraryId: "web",
            blockType: "web",
            entryType: "web",
          })),
        ],
      },
      usage: result.usage,
      traceId: result.traceId,
    });
  } catch (error) {
    logger.error("Chat error", error, { route: "/api/v2/chat" });
    const errorMessage = error instanceof Error ? error.message : "Chat failed";
    return errors.internal(errorMessage);
  }
}
