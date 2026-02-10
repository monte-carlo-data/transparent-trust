/**
 * GTM (Go-To-Market) Data Types
 * Data sourced from Snowflake (synced from Gong, HubSpot, Looker)
 */

// Gong call data (from Snowflake)
export type GongCall = {
  id: string;
  salesforceAccountId: string; // Join key
  title: string;
  date: string; // ISO date string
  duration: number; // in seconds
  participants: string[];
  transcript?: string; // Key for context injection
  summary?: string;
  sentiment?: "positive" | "neutral" | "negative";
  topics?: string[];
};

// HubSpot activity
export type HubSpotActivity = {
  id: string;
  salesforceAccountId: string; // Join key
  type: "email" | "call" | "meeting" | "note" | "task";
  date: string; // ISO date string
  subject: string;
  content?: string;
  associatedDeal?: string;
  owner?: string;
};

// Looker metrics (aggregated)
export type LookerMetrics = {
  salesforceAccountId: string; // Join key
  period: string; // e.g., "2024-Q4", "2024-12"
  metrics: Record<string, number | string>;
};

// Combined GTM data for a customer
export type CustomerGTMData = {
  salesforceAccountId: string;
  customerName?: string;
  gongCalls: GongCall[];
  hubspotActivities: HubSpotActivity[];
  lookerMetrics: LookerMetrics[];
  lastUpdated: string; // ISO date string
};

// Selection state for GTM data in chat context
export type GTMDataSelection = {
  gongCallIds: string[];
  hubspotActivityIds: string[];
  includeMetrics: boolean;
};

// Request type for fetching GTM data
export type FetchGTMDataRequest = {
  salesforceAccountId: string;
  includeGongCalls?: boolean;
  includeHubSpotActivities?: boolean;
  includeLookerMetrics?: boolean;
  gongCallLimit?: number;
  hubspotActivityLimit?: number;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
};

// Response type from the API
export type FetchGTMDataResponse = {
  data: CustomerGTMData;
  metadata: {
    gongCallsTotal: number;
    hubspotActivitiesTotal: number;
    hasMoreGongCalls: boolean;
    hasMoreHubSpotActivities: boolean;
  };
};

/**
 * Build context string from GTM data for LLM consumption
 */
export function buildGTMContextString(data: CustomerGTMData, selection?: GTMDataSelection): string {
  const sections: string[] = [];

  // Gong Calls
  const selectedCalls = selection?.gongCallIds?.length
    ? data.gongCalls.filter((c) => selection.gongCallIds.includes(c.id))
    : data.gongCalls;

  if (selectedCalls.length > 0) {
    const callsSection = selectedCalls.map((call, idx) => {
      const parts = [
        `=== CALL ${idx + 1}: ${call.title} ===`,
        `Date: ${call.date}`,
        `Duration: ${Math.round(call.duration / 60)} minutes`,
        `Participants: ${call.participants.join(", ")}`,
      ];
      if (call.summary) parts.push(`\nSummary:\n${call.summary}`);
      if (call.transcript) parts.push(`\nTranscript:\n${call.transcript}`);
      if (call.topics?.length) parts.push(`\nTopics: ${call.topics.join(", ")}`);
      return parts.join("\n");
    }).join("\n\n---\n\n");

    sections.push(`## Gong Call Transcripts\n\n${callsSection}`);
  }

  // HubSpot Activities
  const selectedActivities = selection?.hubspotActivityIds?.length
    ? data.hubspotActivities.filter((a) => selection.hubspotActivityIds.includes(a.id))
    : data.hubspotActivities;

  if (selectedActivities.length > 0) {
    const activitiesSection = selectedActivities.map((activity, idx) => {
      const parts = [
        `=== ${activity.type.toUpperCase()} ${idx + 1}: ${activity.subject} ===`,
        `Date: ${activity.date}`,
        `Type: ${activity.type}`,
      ];
      if (activity.owner) parts.push(`Owner: ${activity.owner}`);
      if (activity.associatedDeal) parts.push(`Deal: ${activity.associatedDeal}`);
      if (activity.content) parts.push(`\nContent:\n${activity.content}`);
      return parts.join("\n");
    }).join("\n\n---\n\n");

    sections.push(`## HubSpot Activities\n\n${activitiesSection}`);
  }

  // Looker Metrics
  if (selection?.includeMetrics !== false && data.lookerMetrics.length > 0) {
    const metricsSection = data.lookerMetrics.map((m) => {
      const metricLines = Object.entries(m.metrics)
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join("\n");
      return `Period: ${m.period}\n${metricLines}`;
    }).join("\n\n");

    sections.push(`## Business Metrics\n\n${metricsSection}`);
  }

  if (sections.length === 0) {
    return "";
  }

  return `# GTM Data for ${data.customerName || "Customer"}\n\n${sections.join("\n\n")}`;
}
