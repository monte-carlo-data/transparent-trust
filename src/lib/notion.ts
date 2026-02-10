// Notion API Client
// Used for ingesting knowledge from Notion pages
// Fetches pages from team spaces to build skills

import { circuitBreakers } from "./circuitBreaker";
import { getSecret } from "./secrets";

export type NotionConfig = {
  apiToken: string; // Internal integration token (secret_...)
};

// Notion block types we care about for content extraction
export type NotionBlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bulleted_list_item"
  | "numbered_list_item"
  | "toggle"
  | "code"
  | "quote"
  | "callout"
  | "divider"
  | "table"
  | "table_row"
  | "child_page"
  | "child_database"
  | "image"
  | "bookmark"
  | "link_preview"
  | "unsupported";

// Rich text element
export type NotionRichText = {
  type: "text" | "mention" | "equation";
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  mention?: {
    type: "user" | "page" | "database" | "date";
  };
  plain_text: string;
  href?: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
};

// Notion block
export type NotionBlock = {
  object: "block";
  id: string;
  type: NotionBlockType;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  // Block type specific content
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  toggle?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language: string };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[]; icon?: { emoji?: string } };
  child_page?: { title: string };
  child_database?: { title: string };
  image?: {
    type: "external" | "file";
    external?: { url: string };
    file?: { url: string };
    caption?: NotionRichText[];
  };
  bookmark?: { url: string; caption?: NotionRichText[] };
  table?: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
  table_row?: {
    cells: NotionRichText[][];
  };
};

// Notion page
export type NotionPage = {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  parent:
    | { type: "workspace"; workspace: true }
    | { type: "page_id"; page_id: string }
    | { type: "database_id"; database_id: string }
    | { type: "block_id"; block_id: string };
  properties: {
    title?: {
      type: "title";
      title: NotionRichText[];
    };
    // Pages can have various properties
    [key: string]: unknown;
  };
  icon?: { type: "emoji"; emoji: string } | { type: "external"; external: { url: string } } | null;
  cover?: { type: "external"; external: { url: string } } | null;
};

// Simplified page info for UI
export type NotionPageInfo = {
  id: string;
  title: string;
  url: string;
  icon?: string;
  parentId: string | null;
  parentType: "workspace" | "page" | "database" | "block";
  lastEditedTime: string;
  hasChildren: boolean;
  childCount?: number;
};

// Team space / workspace info
export type NotionWorkspace = {
  id: string;
  name: string;
  icon?: string;
};

// Search result
export type NotionSearchResult = {
  pages: NotionPageInfo[];
  hasMore: boolean;
  nextCursor?: string;
};

// Full page with content
export type NotionPageWithContent = {
  page: NotionPageInfo;
  content: string; // Markdown-formatted content
  blocks: NotionBlock[];
  childPages: NotionPageInfo[];
};

// API response types
type NotionApiResponse<T> = T & {
  object: string;
};

type NotionPaginatedResponse<T> = {
  object: "list";
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
};

let cachedConfig: NotionConfig | null = null;

async function getConfig(): Promise<NotionConfig> {
  // Return cached config to avoid repeated secret lookups
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const apiToken = await getSecret("notion-api-token", "NOTION_API_TOKEN");
    cachedConfig = { apiToken };
    return cachedConfig;
  } catch {
    throw new Error(
      "Notion not configured. Set NOTION_API_TOKEN in AWS Secrets Manager or environment variable."
    );
  }
}

export async function isNotionConfigured(): Promise<boolean> {
  try {
    await getSecret("notion-api-token", "NOTION_API_TOKEN");
    return true;
  } catch {
    return false;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const config = await getConfig();
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28", // Latest stable API version
  };
}

/**
 * Make authenticated request to Notion API
 */
async function notionRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `https://api.notion.com/v1/${endpoint}`;
  const authHeaders = await getAuthHeaders();

  const response = await circuitBreakers.notion.execute(() =>
    fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Notion API HTTP error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      errorMessage = `${errorMessage}: ${errorText}`;
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

/**
 * Extract title from a Notion page
 */
function extractPageTitle(page: NotionPage): string {
  // Try to find a title property
  for (const [, value] of Object.entries(page.properties)) {
    if (value && typeof value === "object" && "type" in value && value.type === "title") {
      const titleProp = value as unknown as { title: NotionRichText[] };
      return titleProp.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

/**
 * Extract icon from a Notion page
 */
function extractPageIcon(page: NotionPage): string | undefined {
  if (!page.icon) return undefined;
  if (page.icon.type === "emoji") return page.icon.emoji;
  if (page.icon.type === "external") return page.icon.external.url;
  return undefined;
}

/**
 * Convert Notion page to simplified PageInfo
 */
function pageToInfo(page: NotionPage): NotionPageInfo {
  let parentId: string | null = null;
  let parentType: "workspace" | "page" | "database" | "block" = "workspace";

  if (page.parent.type === "page_id") {
    parentId = page.parent.page_id;
    parentType = "page";
  } else if (page.parent.type === "database_id") {
    parentId = page.parent.database_id;
    parentType = "database";
  } else if (page.parent.type === "block_id") {
    parentId = page.parent.block_id;
    parentType = "block";
  }

  return {
    id: page.id,
    title: extractPageTitle(page),
    url: page.url,
    icon: extractPageIcon(page),
    parentId,
    parentType,
    lastEditedTime: page.last_edited_time,
    hasChildren: false, // Will be updated when fetching children
  };
}

/**
 * Search for pages across all connected workspaces
 */
export async function searchPages(params?: {
  query?: string;
  filter?: "page" | "database";
  startCursor?: string;
  pageSize?: number;
}): Promise<NotionSearchResult> {
  const body: Record<string, unknown> = {
    page_size: params?.pageSize || 50,
  };

  if (params?.query) {
    body.query = params.query;
  }

  if (params?.filter) {
    body.filter = { property: "object", value: params.filter };
  }

  if (params?.startCursor) {
    body.start_cursor = params.startCursor;
  }

  const response = await notionRequest<NotionPaginatedResponse<NotionPage>>(
    "search",
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  const pages = response.results
    .filter((r) => r.object === "page" && !r.archived)
    .map(pageToInfo);

  return {
    pages,
    hasMore: response.has_more,
    nextCursor: response.next_cursor || undefined,
  };
}

/**
 * Get a single page by ID
 */
export async function getPage(pageId: string): Promise<NotionPageInfo> {
  const page = await notionRequest<NotionApiResponse<NotionPage>>(
    `pages/${pageId}`
  );
  return pageToInfo(page);
}

/**
 * Get blocks (content) of a page
 */
export async function getPageBlocks(
  blockId: string,
  startCursor?: string
): Promise<{ blocks: NotionBlock[]; hasMore: boolean; nextCursor?: string }> {
  const params = new URLSearchParams({ page_size: "100" });
  if (startCursor) {
    params.set("start_cursor", startCursor);
  }

  const response = await notionRequest<NotionPaginatedResponse<NotionBlock>>(
    `blocks/${blockId}/children?${params}`
  );

  return {
    blocks: response.results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor || undefined,
  };
}

/**
 * Get all blocks for a page (handles pagination)
 * Also fetches children for blocks that need them (tables, toggles, etc.)
 */
export async function getAllPageBlocks(pageId: string): Promise<NotionBlock[]> {
  const allBlocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const result = await getPageBlocks(pageId, cursor);
    allBlocks.push(...result.blocks);
    cursor = result.hasMore ? result.nextCursor : undefined;

    // Rate limit protection
    if (cursor) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } while (cursor);

  // Fetch children for blocks that have them (tables, toggles, etc.)
  // We need table_row children to render tables
  for (const block of allBlocks) {
    if (block.has_children && (block.type === "table" || block.type === "toggle")) {
      try {
        const children = await getAllPageBlocks(block.id);
        // Store children in a custom property for later processing
        (block as NotionBlock & { children?: NotionBlock[] }).children = children;
      } catch {
        // Ignore errors fetching children
      }
    }
  }

  return allBlocks;
}

/**
 * Get child pages of a page
 */
export async function getChildPages(pageId: string): Promise<NotionPageInfo[]> {
  const blocks = await getAllPageBlocks(pageId);
  const childPages: NotionPageInfo[] = [];

  for (const block of blocks) {
    if (block.type === "child_page" && block.child_page) {
      try {
        const childPage = await getPage(block.id);
        childPage.hasChildren = block.has_children;
        childPages.push(childPage);
      } catch {
        // Child page might not be accessible
      }
    }
  }

  return childPages;
}

/**
 * Extract plain text from rich text array
 */
function richTextToPlain(richText: NotionRichText[]): string {
  return richText.map((t) => t.plain_text).join("");
}

/**
 * Convert rich text to markdown
 */
function richTextToMarkdown(richText: NotionRichText[]): string {
  return richText
    .map((t) => {
      let text = t.plain_text;

      // Apply annotations
      if (t.annotations.code) text = `\`${text}\``;
      if (t.annotations.bold) text = `**${text}**`;
      if (t.annotations.italic) text = `*${text}*`;
      if (t.annotations.strikethrough) text = `~~${text}~~`;

      // Apply link
      if (t.href) text = `[${text}](${t.href})`;

      return text;
    })
    .join("");
}

/**
 * Convert Notion blocks to markdown
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  let listNumber = 1;
  let lastBlockType: NotionBlockType | null = null;

  for (const block of blocks) {
    // Reset numbered list counter when switching block types
    if (block.type !== "numbered_list_item" && lastBlockType === "numbered_list_item") {
      listNumber = 1;
    }

    switch (block.type) {
      case "paragraph":
        if (block.paragraph?.rich_text) {
          lines.push(richTextToMarkdown(block.paragraph.rich_text));
          lines.push("");
        }
        break;

      case "heading_1":
        if (block.heading_1?.rich_text) {
          lines.push(`# ${richTextToMarkdown(block.heading_1.rich_text)}`);
          lines.push("");
        }
        break;

      case "heading_2":
        if (block.heading_2?.rich_text) {
          lines.push(`## ${richTextToMarkdown(block.heading_2.rich_text)}`);
          lines.push("");
        }
        break;

      case "heading_3":
        if (block.heading_3?.rich_text) {
          lines.push(`### ${richTextToMarkdown(block.heading_3.rich_text)}`);
          lines.push("");
        }
        break;

      case "bulleted_list_item":
        if (block.bulleted_list_item?.rich_text) {
          lines.push(`- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`);
        }
        break;

      case "numbered_list_item":
        if (block.numbered_list_item?.rich_text) {
          lines.push(`${listNumber}. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`);
          listNumber++;
        }
        break;

      case "toggle":
        if (block.toggle?.rich_text) {
          lines.push(`> ${richTextToMarkdown(block.toggle.rich_text)}`);
        }
        break;

      case "code":
        if (block.code?.rich_text) {
          const lang = block.code.language || "";
          lines.push(`\`\`\`${lang}`);
          lines.push(richTextToPlain(block.code.rich_text));
          lines.push("```");
          lines.push("");
        }
        break;

      case "quote":
        if (block.quote?.rich_text) {
          lines.push(`> ${richTextToMarkdown(block.quote.rich_text)}`);
          lines.push("");
        }
        break;

      case "callout":
        if (block.callout?.rich_text) {
          const icon = block.callout.icon?.emoji || "💡";
          lines.push(`> ${icon} ${richTextToMarkdown(block.callout.rich_text)}`);
          lines.push("");
        }
        break;

      case "divider":
        lines.push("---");
        lines.push("");
        break;

      case "bookmark":
        if (block.bookmark?.url) {
          const caption = block.bookmark.caption
            ? richTextToPlain(block.bookmark.caption)
            : block.bookmark.url;
          lines.push(`[${caption}](${block.bookmark.url})`);
          lines.push("");
        }
        break;

      case "image":
        if (block.image) {
          const url = block.image.external?.url || block.image.file?.url;
          const caption = block.image.caption
            ? richTextToPlain(block.image.caption)
            : "Image";
          if (url) {
            lines.push(`![${caption}](${url})`);
            lines.push("");
          }
        }
        break;

      case "child_page":
        if (block.child_page?.title) {
          lines.push(`📄 **${block.child_page.title}** (child page)`);
          lines.push("");
        }
        break;

      case "child_database":
        if (block.child_database?.title) {
          lines.push(`📊 **${block.child_database.title}** (database)`);
          lines.push("");
        }
        break;

      case "table": {
        // Tables have children (table_row blocks) that we fetched earlier
        const tableBlock = block as NotionBlock & { children?: NotionBlock[] };
        const rows = tableBlock.children?.filter((b) => b.type === "table_row") || [];

        if (rows.length > 0) {
          const tableRows: string[][] = [];

          for (const row of rows) {
            if (row.table_row?.cells) {
              const cellTexts = row.table_row.cells.map((cell) =>
                richTextToPlain(cell).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\n/g, " ")
              );
              tableRows.push(cellTexts);
            }
          }

          if (tableRows.length > 0) {
            // First row is header
            const headerRow = tableRows[0];
            lines.push(`| ${headerRow.join(" | ")} |`);

            // Separator row
            lines.push(`| ${headerRow.map(() => "---").join(" | ")} |`);

            // Data rows
            for (let i = 1; i < tableRows.length; i++) {
              lines.push(`| ${tableRows[i].join(" | ")} |`);
            }
            lines.push("");
          }
        }
        break;
      }

      case "table_row":
        // Table rows are handled as children of table blocks
        break;

      default:
        // Skip unsupported blocks
        break;
    }

    lastBlockType = block.type;
  }

  // Add newline after list ends
  if (lastBlockType === "bulleted_list_item" || lastBlockType === "numbered_list_item") {
    lines.push("");
  }

  return lines.join("\n").trim();
}

/**
 * Get a page with all its content
 */
export async function getPageWithContent(
  pageId: string
): Promise<NotionPageWithContent> {
  // Fetch page info and blocks in parallel
  const [page, blocks] = await Promise.all([
    getPage(pageId),
    getAllPageBlocks(pageId),
  ]);

  // Extract child pages from blocks
  const childPages: NotionPageInfo[] = [];
  for (const block of blocks) {
    if (block.type === "child_page") {
      try {
        const childPage = await getPage(block.id);
        childPages.push(childPage);
      } catch {
        // Child page might not be accessible
      }
    }
  }

  const content = blocksToMarkdown(blocks);

  return {
    page,
    content,
    blocks,
    childPages,
  };
}

/**
 * Get top-level pages (workspace root pages)
 * Note: Notion API doesn't have a direct "list workspace pages" endpoint,
 * so we use search with an empty query to get recent pages
 */
export async function getTopLevelPages(): Promise<NotionPageInfo[]> {
  const result = await searchPages({ filter: "page", pageSize: 100 });

  // Filter to only pages at workspace root (parentType === "workspace")
  return result.pages.filter((p) => p.parentType === "workspace");
}

/**
 * Build a page tree starting from a given page
 */
export async function getPageTree(
  pageId: string,
  depth: number = 1
): Promise<NotionPageInfo & { children?: NotionPageInfo[] }> {
  const page = await getPage(pageId);

  if (depth <= 0 || !page.hasChildren) {
    return page;
  }

  const children = await getChildPages(pageId);

  return {
    ...page,
    children,
  };
}

/**
 * Parse a Notion URL to extract the page ID
 */
export function parseNotionUrl(url: string): string | null {
  // Notion URLs can be:
  // - https://www.notion.so/workspace/Page-Title-abc123def456
  // - https://www.notion.so/abc123def456
  // - https://notion.so/workspace/Page-Title-abc123def456?v=xyz
  // - abc123def456 (just the ID)

  // If it's already a UUID-like ID (with or without dashes)
  const uuidRegex = /^[a-f0-9]{32}$|^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (uuidRegex.test(url)) {
    return url.replace(/-/g, "");
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("notion.so")) {
      return null;
    }

    // Get the last path segment
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const lastPart = pathParts[pathParts.length - 1];

    // The ID is the last 32 characters (without dashes) of the slug
    // e.g., "Page-Title-abc123def456" -> "abc123def456"
    const idMatch = lastPart.match(/([a-f0-9]{32})$/i);
    if (idMatch) {
      return idMatch[1];
    }

    // Try to extract from hyphenated format at end of slug
    const hyphenatedMatch = lastPart.match(
      /([a-f0-9]{8}[a-f0-9]{4}[a-f0-9]{4}[a-f0-9]{4}[a-f0-9]{12})$/i
    );
    if (hyphenatedMatch) {
      return hyphenatedMatch[1].replace(/-/g, "");
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Import a page by URL
 */
export async function importPageByUrl(
  url: string
): Promise<NotionPageWithContent> {
  const pageId = parseNotionUrl(url);
  if (!pageId) {
    throw new Error("Invalid Notion URL");
  }
  return getPageWithContent(pageId);
}

// Document source format for skill generation (matches Zendesk/Slack)
export type DocumentSource = {
  id: string;
  title: string;
  filename: string;
  content: string;
};

/**
 * Convert a Notion page to DocumentSource format
 * This is the format expected by the skill generation pipeline
 */
export function pageToDocumentSource(
  page: NotionPageInfo,
  content: string
): DocumentSource {
  const parts: string[] = [];

  // Header
  parts.push(`# ${page.title}`);
  parts.push("");
  parts.push(`**Source:** Notion`);
  parts.push(`**URL:** ${page.url}`);
  parts.push(`**Last Updated:** ${new Date(page.lastEditedTime).toISOString().split("T")[0]}`);
  parts.push("");

  // Content
  parts.push("## Content");
  parts.push("");
  parts.push(content);

  return {
    id: `notion-${page.id}`,
    title: page.title,
    filename: `notion-page-${page.id.substring(0, 8)}.md`,
    content: parts.join("\n"),
  };
}
