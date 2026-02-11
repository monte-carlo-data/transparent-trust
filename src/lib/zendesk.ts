// Zendesk API Client
// Used for internal IT helpdesk ticket integration
// Fetches resolved tickets to build IT knowledge skills

import { circuitBreakers } from "./circuitBreaker";
import { getSecret } from "./secrets";

export type ZendeskConfig = {
  subdomain: string;
  email: string;
  apiToken: string;
};

// Zendesk Ticket types
export type ZendeskTicket = {
  id: number;
  url: string;
  subject: string;
  description: string; // Initial request text
  status: "new" | "open" | "pending" | "hold" | "solved" | "closed";
  priority: "urgent" | "high" | "normal" | "low" | null;
  requester_id: number;
  assignee_id: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  solved_at: string | null;
  // Custom fields come as array
  custom_fields?: Array<{ id: number; value: string | null }>;
  // Form info
  ticket_form_id?: number;
};

export type ZendeskComment = {
  id: number;
  type: "Comment";
  author_id: number;
  body: string;
  html_body: string;
  plain_body: string;
  public: boolean;
  created_at: string;
};

export type ZendeskUser = {
  id: number;
  name: string;
  email: string;
  role: "end-user" | "agent" | "admin";
};

export type ZendeskTicketWithComments = ZendeskTicket & {
  comments: ZendeskComment[];
  requester?: ZendeskUser;
  assignee?: ZendeskUser;
};

// Pagination response types
type ZendeskListResponse<T> = {
  tickets?: T[];
  comments?: T[];
  users?: T[];
  count?: number;
  next_page: string | null;
  previous_page: string | null;
};

type ZendeskIncrementalResponse = {
  tickets: ZendeskTicket[];
  end_of_stream: boolean;
  end_time: number;
  next_page: string | null;
  count: number;
};

let cachedConfig: ZendeskConfig | null = null;

async function getConfig(): Promise<ZendeskConfig> {
  // Return cached config to avoid repeated secret lookups
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const subdomain = await getSecret("zendesk-internal-subdomain", "ZENDESK_SUBDOMAIN");
    const email = await getSecret("zendesk-internal-email", "ZENDESK_EMAIL");
    const apiToken = await getSecret("zendesk-internal-api-token", "ZENDESK_API_TOKEN");

    cachedConfig = { subdomain, email, apiToken };
    return cachedConfig;
  } catch {
    throw new Error(
      "Zendesk not configured. Set ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, and ZENDESK_API_TOKEN in AWS Secrets Manager or environment variables."
    );
  }
}

export async function isZendeskConfigured(): Promise<boolean> {
  try {
    await getSecret("zendesk-internal-subdomain", "ZENDESK_SUBDOMAIN");
    return true;
  } catch {
    return false;
  }
}

async function getAuthHeader(): Promise<string> {
  const config = await getConfig();
  // Zendesk API token auth: email/token:apiToken
  const credentials = `${config.email}/token:${config.apiToken}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

async function getBaseUrl(): Promise<string> {
  const config = await getConfig();
  return `https://${config.subdomain}.zendesk.com`;
}

/**
 * Make authenticated request to Zendesk API
 */
async function zendeskRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getBaseUrl();
  const authHeader = await getAuthHeader();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const response = await circuitBreakers.zendesk.execute(() =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zendesk API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch tickets using search query
 * Supports filtering by status, tags, date range
 */
export async function searchTickets(params: {
  status?: string[];
  tags?: string[];
  since?: Date;
  formId?: number;
  limit?: number;
}): Promise<ZendeskTicket[]> {
  const queryParts: string[] = ["type:ticket"];

  // Status filter - we'll filter on our end after fetching
  // Zendesk search has quirks with multiple statuses, so we fetch all and filter
  const statusFilter = params.status || ["solved", "closed"];

  // Tags filter
  if (params.tags && params.tags.length > 0) {
    // Search for tickets with ANY of the tags
    const tagQuery = params.tags.map((t) => `tags:${t}`).join(" ");
    queryParts.push(`(${tagQuery})`);
  }

  // Date filter - use solved_at to get tickets solved since a date
  // This captures tickets that were recently resolved, regardless of when they were created
  if (params.since) {
    const dateStr = params.since.toISOString().split("T")[0];
    queryParts.push(`solved>${dateStr}`);
  }

  // Form filter
  if (params.formId) {
    queryParts.push(`ticket_form_id:${params.formId}`);
  }

  const query = queryParts.join(" ");
  // Debug: Log the query being sent to Zendesk
  console.log("[Zendesk] Search query:", query);
  console.log("[Zendesk] Query URL:", `/api/v2/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc`);
  const allTickets: ZendeskTicket[] = [];
  let nextPage: string | null = `/api/v2/search.json?query=${encodeURIComponent(query)}&sort_by=created_at&sort_order=desc`;
  const maxTickets = params.limit || 500;

  type SearchResponse = {
    results: ZendeskTicket[];
    next_page: string | null;
    count: number;
  };

  while (nextPage && allTickets.length < maxTickets) {
    const searchResponse: SearchResponse = await zendeskRequest<SearchResponse>(nextPage);
    console.log("[Zendesk] Response count:", searchResponse.count, "results:", searchResponse.results?.length || 0);

    allTickets.push(...searchResponse.results);
    nextPage = searchResponse.next_page;

    // Rate limit: Zendesk allows ~100 requests/minute for search
    // Add small delay between pagination requests
    if (nextPage) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Filter by status on our end (Zendesk query syntax for multiple statuses is buggy)
  const filteredTickets = allTickets.filter(t => statusFilter.includes(t.status));
  console.log("[Zendesk] After status filter:", filteredTickets.length, "of", allTickets.length);

  return filteredTickets.slice(0, maxTickets);
}

/**
 * Fetch tickets incrementally (for sync)
 * More efficient than search for getting updates since last sync
 */
export async function fetchTicketsIncremental(
  startTime: Date
): Promise<ZendeskTicket[]> {
  const allTickets: ZendeskTicket[] = [];
  const startTimeUnix = Math.floor(startTime.getTime() / 1000);

  let nextPage: string | null = `/api/v2/incremental/tickets.json?start_time=${startTimeUnix}`;

  while (nextPage) {
    const incrementalResponse: ZendeskIncrementalResponse = await zendeskRequest<ZendeskIncrementalResponse>(nextPage);

    // Filter to only solved/closed tickets
    const resolvedTickets = incrementalResponse.tickets.filter(
      (t) => t.status === "solved" || t.status === "closed"
    );
    allTickets.push(...resolvedTickets);

    if (incrementalResponse.end_of_stream) {
      break;
    }

    nextPage = incrementalResponse.next_page;

    // Rate limit: Incremental API allows 10 requests/minute
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }

  return allTickets;
}

/**
 * Fetch comments for a ticket (to get the resolution)
 */
export async function fetchTicketComments(
  ticketId: number
): Promise<ZendeskComment[]> {
  const response = await zendeskRequest<ZendeskListResponse<ZendeskComment>>(
    `/api/v2/tickets/${ticketId}/comments.json`
  );

  return response.comments || [];
}

/**
 * Fetch user details
 */
export async function fetchUser(userId: number): Promise<ZendeskUser> {
  const response = await zendeskRequest<{ user: ZendeskUser }>(
    `/api/v2/users/${userId}.json`
  );
  return response.user;
}

/**
 * Fetch ticket with all comments and user info
 * This is what we need for skill generation
 */
export async function fetchTicketWithDetails(
  ticketId: number
): Promise<ZendeskTicketWithComments> {
  // Fetch ticket, comments, and relevant users in parallel
  const [ticketResponse, comments] = await Promise.all([
    zendeskRequest<{ ticket: ZendeskTicket }>(`/api/v2/tickets/${ticketId}.json`),
    fetchTicketComments(ticketId),
  ]);

  const ticket = ticketResponse.ticket;

  // Fetch requester and assignee info
  const [requester, assignee] = await Promise.all([
    ticket.requester_id ? fetchUser(ticket.requester_id) : undefined,
    ticket.assignee_id ? fetchUser(ticket.assignee_id) : undefined,
  ]);

  return {
    ...ticket,
    comments,
    requester,
    assignee,
  };
}

/**
 * Fetch multiple tickets with details (batched)
 */
export async function fetchTicketsWithDetails(
  ticketIds: number[]
): Promise<ZendeskTicketWithComments[]> {
  const results: ZendeskTicketWithComments[] = [];

  // Process in batches of 5 to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < ticketIds.length; i += batchSize) {
    const batch = ticketIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((id) => fetchTicketWithDetails(id))
    );
    results.push(...batchResults);

    // Rate limit delay between batches
    if (i + batchSize < ticketIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get all unique tags from a set of tickets
 */
export function extractUniqueTags(tickets: ZendeskTicket[]): string[] {
  const tagSet = new Set<string>();
  for (const ticket of tickets) {
    for (const tag of ticket.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Group tickets by tag
 * Returns map of tag -> tickets that have that tag
 */
export function groupTicketsByTag(
  tickets: ZendeskTicket[]
): Map<string, ZendeskTicket[]> {
  const groups = new Map<string, ZendeskTicket[]>();

  for (const ticket of tickets) {
    for (const tag of ticket.tags) {
      const existing = groups.get(tag) || [];
      existing.push(ticket);
      groups.set(tag, existing);
    }
  }

  return groups;
}

/**
 * Group tickets by primary tag (first tag or most specific)
 * This is a simpler grouping for skill generation
 */
export function groupTicketsByPrimaryTag(
  tickets: ZendeskTicket[],
  priorityTags?: string[]
): Map<string, ZendeskTicket[]> {
  const groups = new Map<string, ZendeskTicket[]>();

  for (const ticket of tickets) {
    // Find primary tag: first matching priority tag, or first tag
    let primaryTag = ticket.tags[0] || "untagged";

    if (priorityTags) {
      const matchingPriority = ticket.tags.find((t) => priorityTags.includes(t));
      if (matchingPriority) {
        primaryTag = matchingPriority;
      }
    }

    const existing = groups.get(primaryTag) || [];
    existing.push(ticket);
    groups.set(primaryTag, existing);
  }

  return groups;
}

// Document source format for skill generation
export type DocumentSource = {
  id: string;
  title: string;
  filename: string;
  content: string;
};

/**
 * Convert a ticket with comments to DocumentSource format
 * This is the format expected by the skill generation pipeline
 */
export function ticketToDocumentSource(
  ticket: ZendeskTicketWithComments
): DocumentSource {
  // Build content from ticket + comments
  const parts: string[] = [];

  // Header with ticket info
  parts.push(`# Ticket #${ticket.id}: ${ticket.subject}`);
  parts.push("");
  parts.push(`**Status:** ${ticket.status}`);
  parts.push(`**Tags:** ${ticket.tags.join(", ") || "none"}`);
  if (ticket.requester) {
    parts.push(`**Requester:** ${ticket.requester.name}`);
  }
  if (ticket.assignee) {
    parts.push(`**Assignee:** ${ticket.assignee.name}`);
  }
  parts.push(`**Created:** ${ticket.created_at}`);
  if (ticket.solved_at) {
    parts.push(`**Solved:** ${ticket.solved_at}`);
  }
  parts.push("");

  // Initial request
  parts.push("## Request");
  parts.push(ticket.description);
  parts.push("");

  // Resolution (agent comments)
  const agentComments = ticket.comments.filter((c) => {
    // Skip the initial description (first comment is usually the request)
    // Include public comments from agents
    return c.public;
  });

  if (agentComments.length > 1) {
    parts.push("## Resolution");
    // Skip first comment (usually the initial request)
    for (const comment of agentComments.slice(1)) {
      parts.push(comment.plain_body || comment.body);
      parts.push("");
    }
  }

  return {
    id: `zendesk-${ticket.id}`,
    title: ticket.subject,
    filename: `ticket-${ticket.id}.md`,
    content: parts.join("\n"),
  };
}

/**
 * Convert multiple tickets to DocumentSource array
 */
export function ticketsToDocumentSources(
  tickets: ZendeskTicketWithComments[]
): DocumentSource[] {
  return tickets.map(ticketToDocumentSource);
}

/**
 * Fetch and convert tickets for a specific tag group
 * Returns DocumentSource array ready for skill generation
 */
export async function fetchTicketGroupForSkillGeneration(params: {
  tags: string[];
  since?: Date;
  limit?: number;
}): Promise<{
  tickets: ZendeskTicketWithComments[];
  documents: DocumentSource[];
  tags: string[];
}> {
  // Default to last 3 months
  const since = params.since || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // Search for tickets with these tags
  const tickets = await searchTickets({
    tags: params.tags,
    since,
    limit: params.limit || 50,
  });

  if (tickets.length === 0) {
    return { tickets: [], documents: [], tags: params.tags };
  }

  // Fetch full details for each ticket
  const ticketsWithDetails = await fetchTicketsWithDetails(
    tickets.map((t) => t.id)
  );

  // Convert to document sources
  const documents = ticketsToDocumentSources(ticketsWithDetails);

  return {
    tickets: ticketsWithDetails,
    documents,
    tags: params.tags,
  };
}

// ============================================
// TICKET CREATION
// ============================================

export type CreateTicketParams = {
  subject: string;
  description: string;
  requesterEmail: string;
  requesterName?: string;
  priority?: "urgent" | "high" | "normal" | "low";
  tags?: string[];
  customFields?: Array<{ id: number; value: string }>;
};

export type CreateTicketResult = {
  id: number;
  url: string;
  subject: string;
  status: string;
};

/**
 * Create a new Zendesk ticket
 * Used by IT helpbot to escalate issues
 */
export async function createTicket(
  params: CreateTicketParams
): Promise<CreateTicketResult> {
  const config = await getConfig();

  const ticketData = {
    ticket: {
      subject: params.subject,
      comment: {
        body: params.description,
      },
      requester: {
        email: params.requesterEmail,
        name: params.requesterName || params.requesterEmail.split("@")[0],
      },
      priority: params.priority || "normal",
      tags: params.tags || ["slack-bot", "it-helpbot"],
      custom_fields: params.customFields,
    },
  };

  const response = await zendeskRequest<{ ticket: ZendeskTicket }>(
    "/api/v2/tickets.json",
    {
      method: "POST",
      body: JSON.stringify(ticketData),
    }
  );

  const ticket = response.ticket;

  return {
    id: ticket.id,
    url: `https://${config.subdomain}.zendesk.com/agent/tickets/${ticket.id}`,
    subject: ticket.subject,
    status: ticket.status,
  };
}
