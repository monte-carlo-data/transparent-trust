import { prisma } from '@/lib/prisma';
import { executeLLMCall } from '@/lib/llm/registry';
import { getViewDefinitions, getViewDefinitionById, type ViewDefinition } from './view-definitions';
import {
  getLookerContextForAudit,
  isAuditComposition,
  getAuditTypeFromComposition,
} from './looker-context-service';
import { logger } from '@/lib/logger';
import type { LibraryId } from '@/types/v2';
import type { Prisma } from '@prisma/client';

/**
 * State summary structure for audit comparison
 */
export interface AuditStateSummary {
  auditType: 'coverage' | 'operations' | 'adoption';
  generatedAt: string;
  keyMetrics: Array<{
    label: string;
    value: string | number;
    trend?: 'up' | 'down' | 'stable';
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  topFindings: string[];
}

/**
 * Get all active view definitions (code-based, not database)
 */
export function getActiveViews(): ViewDefinition[] {
  return getViewDefinitions();
}

/**
 * Get or generate view output for a customer
 * Caches results to avoid regenerating the same analysis multiple times
 */
export async function getOrGenerateViewOutput(
  viewId: string,
  customerId: string,
  customerContext: {
    title: string;
    attributes: unknown;
    skills: Array<{ id: string; title: string; content?: string; summary?: string }>;
  },
  forceRefresh = false,
  libraryId?: LibraryId
) {
  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.generatedView.findUnique({
      where: { viewId_customerId: { viewId, customerId } },
    });
    if (cached) return cached;
  }

  // Get view definition from code (not database)
  const viewDef = getViewDefinitionById(viewId);
  if (!viewDef) throw new Error('View not found');

  const { compositionId, title: viewTitle } = viewDef;

  // Build customer context for prompt - include full skill content
  const skillsList = customerContext.skills
    .map((s) => `## ${s.title}\n${s.content || s.summary || '(No content)'}`)
    .join('\n\n');

  let question = `Generate analysis for customer: ${customerContext.title}

Customer data:
${JSON.stringify(customerContext.attributes, null, 2)}

Customer skills:
${skillsList || '(No skills yet)'}`;

  // For audit compositions, include Looker dashboard data
  const auditType = getAuditTypeFromComposition(compositionId);
  if (isAuditComposition(compositionId) && libraryId && auditType) {
    try {
      const lookerContext = await getLookerContextForAudit(libraryId, customerId, auditType);
      if (lookerContext) {
        // Limit JSON size to avoid token bloat (similar to HTML table row limit)
        let dashboardJson = lookerContext.rawJson;
        if (dashboardJson.length > 50000) {
          // Truncate very large JSON payloads
          dashboardJson = dashboardJson.substring(0, 50000) + '\n... (truncated, data too large)';
        }
        question += `

Looker Dashboard Data:
${dashboardJson}`;
      } else {
        logger.warn('No Looker data available for audit', { viewId, customerId, libraryId, auditType });
      }
    } catch (error) {
      logger.error('Failed to fetch Looker context for audit', { viewId, customerId, libraryId, auditType, error });
      throw new Error(`Failed to fetch Looker dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Call LLM with view's composition
  const result = await executeLLMCall({
    question,
    compositionId,
    skills: customerContext.skills.map((s) => ({
      id: s.id,
      title: s.title,
      content: s.content || '',
    })),
  });

  // Extract state summary for audit views (for historical comparison)
  let stateSummary: Prisma.InputJsonValue | undefined;
  if (auditType) {
    const summary = extractAuditStateSummary(result.answer, auditType);
    // Convert to plain JSON object for Prisma
    stateSummary = JSON.parse(JSON.stringify(summary)) as Prisma.InputJsonValue;
  }

  // Upsert result
  const generated = await prisma.generatedView.upsert({
    where: { viewId_customerId: { viewId, customerId } },
    create: {
      viewId,
      customerId,
      title: viewTitle,
      content: result.answer,
      usedBlockIds: result.transparency?.blockIds || [],
      ...(stateSummary && { stateSummary }),
    },
    update: {
      content: result.answer,
      generatedAt: new Date(),
      usedBlockIds: result.transparency?.blockIds || [],
      ...(stateSummary && { stateSummary }),
    },
  });

  return {
    ...generated,
    transparency: result.transparency,
  };
}

/**
 * Extract structured state summary from audit content for historical comparison
 */
function extractAuditStateSummary(
  content: string,
  auditType: 'coverage' | 'operations' | 'adoption'
): AuditStateSummary {
  const summary: AuditStateSummary = {
    auditType,
    generatedAt: new Date().toISOString(),
    keyMetrics: [],
    riskLevel: 'medium',
    topFindings: [],
  };

  // Extract assessment level from Executive Summary
  const assessmentMatch = content.match(/\*\*Assessment:\*\*\s*(Healthy|Needs Attention|At Risk)/i);
  if (assessmentMatch) {
    const assessment = assessmentMatch[1].toLowerCase();
    if (assessment === 'healthy') summary.riskLevel = 'low';
    else if (assessment === 'at risk') summary.riskLevel = 'high';
    else summary.riskLevel = 'medium';
  }

  // Extract key metrics from the Key Metrics Summary table
  const metricsTableMatch = content.match(/## Key Metrics Summary[\s\S]*?\|[\s\S]*?\|([\s\S]*?)(?=\n##|\n---|\n\n\n|$)/);
  if (metricsTableMatch) {
    const tableContent = metricsTableMatch[1];
    const rows = tableContent.split('\n').filter((row) => row.includes('|') && !row.includes('---'));

    for (const row of rows) {
      const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const label = cells[0];
        const value = cells[1];
        // Skip header row
        if (label.toLowerCase() === 'metric') continue;

        // Determine trend from status emoji if present
        let trend: 'up' | 'down' | 'stable' | undefined;
        const statusCell = cells[cells.length - 1];
        if (statusCell?.includes('🟢')) trend = 'up';
        else if (statusCell?.includes('🔴')) trend = 'down';
        else if (statusCell?.includes('🟡')) trend = 'stable';

        summary.keyMetrics.push({ label, value, trend });
      }
    }
  }

  // Extract top findings from Executive Summary bullets or Key Finding
  const keyFindingMatch = content.match(/\*\*Key Finding:\*\*\s*(.+)/i);
  if (keyFindingMatch) {
    summary.topFindings.push(keyFindingMatch[1].trim());
  }

  // Extract findings from Analysis section headers
  const analysisMatch = content.match(/## Analysis([\s\S]*?)(?=## Key Metrics|## Next Steps|## Slide Outline|$)/);
  if (analysisMatch) {
    const analysisContent = analysisMatch[1];
    const observationMatches = analysisContent.matchAll(/\*\*Observation:\*\*\s*(.+)/gi);
    for (const match of observationMatches) {
      if (summary.topFindings.length < 5) {
        summary.topFindings.push(match[1].trim().substring(0, 200));
      }
    }
  }

  return summary;
}

/**
 * Get all generated views for a customer
 */
export async function getGeneratedViewsForCustomer(customerId: string) {
  return prisma.generatedView.findMany({
    where: { customerId },
  });
}

/**
 * Delete generated views for a customer (cleanup)
 */
export async function deleteGeneratedViewsForCustomer(customerId: string) {
  return prisma.generatedView.deleteMany({
    where: { customerId },
  });
}
