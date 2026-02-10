/**
 * Google Slides API integration
 * Uses OAuth tokens stored by NextAuth to access user's presentations
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

// Google API endpoints
const SLIDES_API_BASE = "https://slides.googleapis.com/v1";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Types
export type SlidePresentation = {
  presentationId: string;
  title: string;
  locale?: string;
  slides?: SlidePage[];
};

export type SlidePage = {
  objectId: string;
  pageElements?: PageElement[];
};

export type PageElement = {
  objectId: string;
  shape?: {
    shapeType: string;
    text?: {
      textElements?: TextElement[];
    };
  };
};

export type TextElement = {
  textRun?: {
    content: string;
  };
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

export type PlaceholderReplacement = {
  placeholder: string; // e.g., "{{Customer}}" or "Customer" (we'll add braces)
  value: string;
};

/**
 * Get valid Google access token for a user
 * Refreshes if expired
 */
async function getAccessToken(userId: string): Promise<string | null> {
  // Find the user's Google account
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account) {
    logger.warn("No Google account found for user", { userId });
    return null;
  }

  // Check if token is still valid (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;

  if (account.access_token && expiresAt > now + 300) {
    return account.access_token;
  }

  // Need to refresh
  if (!account.refresh_token) {
    logger.warn("No refresh token available for user", { userId });
    return null;
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error("Failed to refresh Google token", { error, userId });
      return null;
    }

    const data = await response.json();

    // Update stored token
    await prisma.account.updateMany({
      where: {
        userId,
        provider: "google",
      },
      data: {
        access_token: data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      },
    });

    return data.access_token;
  } catch (error) {
    logger.error("Error refreshing Google token", error, { userId });
    return null;
  }
}

/**
 * List user's Google Slides presentations
 */
export async function listPresentations(
  userId: string,
  options: { maxResults?: number; query?: string } = {}
): Promise<DriveFile[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error("No valid Google access token");
  }

  const { maxResults = 20, query } = options;

  // Build query for Google Slides files
  let q = "mimeType='application/vnd.google-apps.presentation'";
  if (query) {
    q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
  }

  const params = new URLSearchParams({
    q,
    pageSize: String(maxResults),
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,thumbnailLink)",
    orderBy: "modifiedTime desc",
  });

  const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to list presentations", { error, userId });
    throw new Error(`Failed to list presentations: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Get a specific presentation
 */
export async function getPresentation(
  userId: string,
  presentationId: string
): Promise<SlidePresentation> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error("No valid Google access token");
  }

  const response = await fetch(`${SLIDES_API_BASE}/presentations/${presentationId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to get presentation", { error, userId, presentationId });
    throw new Error(`Failed to get presentation: ${response.status}`);
  }

  return response.json();
}

/**
 * Extract all text placeholders from a presentation
 * Looks for {{placeholder}} patterns in slide text
 */
export async function extractPlaceholders(
  userId: string,
  presentationId: string
): Promise<string[]> {
  const presentation = await getPresentation(userId, presentationId);
  const placeholders = new Set<string>();

  // Regex to find {{placeholder}} patterns
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  // Walk through all slides and text elements
  for (const slide of presentation.slides || []) {
    for (const element of slide.pageElements || []) {
      if (element.shape?.text?.textElements) {
        for (const textEl of element.shape.text.textElements) {
          if (textEl.textRun?.content) {
            const matches = textEl.textRun.content.matchAll(placeholderRegex);
            for (const match of matches) {
              placeholders.add(match[1]); // Add without braces
            }
          }
        }
      }
    }
  }

  return Array.from(placeholders);
}

/**
 * Fill placeholders in a presentation
 * Creates a copy and fills it with provided values
 */
export async function fillPresentation(
  userId: string,
  presentationId: string,
  replacements: PlaceholderReplacement[],
  options: { copyFirst?: boolean; copyTitle?: string } = {}
): Promise<{ presentationId: string; webViewLink: string }> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error("No valid Google access token");
  }

  let targetPresentationId = presentationId;

  // Optionally copy the presentation first
  if (options.copyFirst) {
    const copyResponse = await fetch(`${DRIVE_API_BASE}/files/${presentationId}/copy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: options.copyTitle || `Filled - ${new Date().toISOString().split("T")[0]}`,
      }),
    });

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      logger.error("Failed to copy presentation", { error, userId, presentationId });
      throw new Error(`Failed to copy presentation: ${copyResponse.status}`);
    }

    const copyData = await copyResponse.json();
    targetPresentationId = copyData.id;
  }

  // Build batch update requests for text replacement
  const requests = replacements.map((r) => {
    // Ensure placeholder has braces
    const placeholder = r.placeholder.startsWith("{{") ? r.placeholder : `{{${r.placeholder}}}`;
    return {
      replaceAllText: {
        containsText: {
          text: placeholder,
          matchCase: false,
        },
        replaceText: r.value,
      },
    };
  });

  if (requests.length > 0) {
    const batchResponse = await fetch(
      `${SLIDES_API_BASE}/presentations/${targetPresentationId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!batchResponse.ok) {
      const error = await batchResponse.text();
      logger.error("Failed to fill presentation", { error, userId, targetPresentationId });
      throw new Error(`Failed to fill presentation: ${batchResponse.status}`);
    }
  }

  // Get the web view link
  const fileResponse = await fetch(
    `${DRIVE_API_BASE}/files/${targetPresentationId}?fields=webViewLink`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let webViewLink = `https://docs.google.com/presentation/d/${targetPresentationId}/edit`;
  if (fileResponse.ok) {
    const fileData = await fileResponse.json();
    webViewLink = fileData.webViewLink || webViewLink;
  }

  return { presentationId: targetPresentationId, webViewLink };
}

/**
 * Check if user has Google Slides access
 */
export async function hasGoogleSlidesAccess(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
    select: {
      scope: true,
    },
  });

  if (!account?.scope) return false;

  // Check if presentations scope is included (for reading/listing)
  // drive scope is needed for copying but we'll let that fail at runtime with a clear message
  return account.scope.includes("presentations") || account.scope.includes("drive");
}
