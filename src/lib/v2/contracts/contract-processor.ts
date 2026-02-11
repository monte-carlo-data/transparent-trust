/**
 * Contract Analysis Processor
 *
 * Executes single LLM call to analyze contract against selected skills.
 * Updates BulkRow with findings array on completion.
 */

import prisma from '@/lib/prisma';
import { executeLLMCall } from '@/lib/llm/registry';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import type { ModelSpeed } from '@/lib/config';
import type { LibraryId } from '@/types/v2';

export interface ContractProcessorParams {
  projectId: string;
  skillIds: string[];
  libraryId: LibraryId;
  modelSpeed: ModelSpeed;
}

export interface ContractProcessorResult {
  projectId: string;
  status: 'COMPLETED' | 'ERROR';
  findingsCount: number;
  error?: string;
}

// Import the canonical type from contractReview.ts instead of duplicating
import type { ContractFinding } from '@/types/contractReview';

interface LLMAnalysisResponse {
  overallRating: 'compliant' | 'mostly_compliant' | 'needs_review' | 'high_risk';
  summary: string;
  findings: Array<{
    category: string;
    clauseText: string;
    rating: string;
    rationale: string;
    suggestedResponse?: string;
  }>;
}

/**
 * Analyze contract using LLM with selected skills
 */
export async function processContract(
  params: ContractProcessorParams
): Promise<ContractProcessorResult> {
  const { projectId, skillIds, libraryId, modelSpeed } = params;

  try {
    // 1. Fetch project with contract text
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      include: { rows: true },
    });

    if (!project || project.projectType !== 'contract-review') {
      throw new Error('Invalid contract project');
    }

    if (!project.fileContext || project.fileContext.length === 0) {
      throw new Error('No contract text found');
    }

    const row = project.rows[0];
    if (!row) {
      throw new Error('No row found for contract');
    }

    // 2. Fetch skills
    const { allSkills } = await fetchContractSkills({
      skillIds,
      libraryId,
      customerId: project.customerId,
    });

    if (allSkills.length === 0) {
      throw new Error('No valid skills found');
    }

    logger.info('Starting contract processing', {
      projectId,
      projectName: project.name,
      contractLength: project.fileContext.length,
      skillCount: allSkills.length,
      modelSpeed,
    });

    // 3. Update project to PROCESSING
    await prisma.bulkProject.update({
      where: { id: projectId },
      data: { status: 'PROCESSING' },
    });

    // 4. Execute LLM call via registry
    const result = await executeLLMCall({
      question: `Analyze this contract against the organization's documented capabilities:\n\n${project.fileContext}`,
      compositionId: 'contract_analysis',
      skills: allSkills.map((s) => ({ title: s.title, content: s.content })),
      modelSpeed,
      runtimeContext: {},
    });

    // 5. Parse JSON response
    let analysis: LLMAnalysisResponse;
    try {
      // Remove markdown code blocks if present
      let cleanedAnswer = result.answer.trim();
      if (cleanedAnswer.startsWith('```json')) {
        cleanedAnswer = cleanedAnswer.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedAnswer.startsWith('```')) {
        cleanedAnswer = cleanedAnswer.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      analysis = JSON.parse(cleanedAnswer);
    } catch (parseError) {
      logger.error('Failed to parse LLM response as JSON', parseError, {
        projectId,
        response: result.answer.substring(0, 500),
      });
      throw new Error('LLM returned invalid JSON response');
    }

    // 6. Validate response structure
    if (!analysis.findings || !Array.isArray(analysis.findings)) {
      throw new Error('LLM response missing findings array');
    }

    if (!analysis.overallRating || !analysis.summary) {
      throw new Error('LLM response missing overallRating or summary');
    }

    // 7. Augment findings with workflow fields and generate unique IDs
    const findings = analysis.findings.map((f, idx) => ({
      ...f as Omit<ContractFinding, 'id' | 'contractReviewId' | 'index'>,
      id: `${projectId}-finding-${idx}`, // Generate unique ID for frontend
      contractReviewId: projectId, // Link back to project
      index: idx,
      flaggedForReview: false,
      flaggedAt: undefined,
      flaggedBy: undefined,
      reviewNote: undefined,
      reviewStatus: 'NONE' as const,
      reviewedAt: undefined,
      reviewedBy: undefined,
      editedAt: undefined,
      editedBy: undefined,
      originalText: undefined,
      // Additional fields for compatibility with contractReview.ts type
      flagResolved: false,
      flagResolvedAt: undefined,
      flagResolvedBy: undefined,
      flagResolutionNote: undefined,
      reviewRequestedAt: undefined,
      reviewRequestedBy: undefined,
      assignedToSecurity: false,
      assignedToSecurityAt: undefined,
      assignedToSecurityBy: undefined,
      securityReviewNote: undefined,
      securityReviewedAt: undefined,
      securityReviewedBy: undefined,
      isManuallyAdded: false,
      originalSuggestedResponse: undefined,
      originalRating: undefined,
      originalRationale: undefined,
      relevantSkills: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as ContractFinding[];

    // 8. Update BulkRow with findings
    await prisma.bulkRow.update({
      where: { id: row.id },
      data: {
        outputData: {
          overallRating: analysis.overallRating,
          summary: analysis.summary,
          findings,
          transparency: {
            compositionId: result.transparency.compositionId,
            blockIds: result.transparency.blockIds,
            skillIds,
            skillCount: allSkills.length,
            modelSpeed,
            systemPrompt: result.transparency.systemPrompt,
            model: result.usage?.model || 'unknown',
            inputTokens: result.usage?.inputTokens || 0,
            outputTokens: result.usage?.outputTokens || 0,
          },
        },
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    // 9. Update project to COMPLETED
    await prisma.bulkProject.update({
      where: { id: projectId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    logger.info('Contract processing complete', {
      projectId,
      findingsCount: findings.length,
      overallRating: analysis.overallRating,
    });

    return {
      projectId,
      status: 'COMPLETED',
      findingsCount: findings.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorId = generateErrorId();

    logger.error('Contract processing failed', error, {
      projectId,
      errorId,
    });

    // Update row to ERROR state
    const row = await prisma.bulkRow.findFirst({
      where: { projectId },
    });

    if (row) {
      await prisma.bulkRow.update({
        where: { id: row.id },
        data: {
          status: 'ERROR',
          processedAt: new Date(),
          outputData: {
            error: errorMessage,
            errorId,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          },
        },
      });
    }

    // Update project to ERROR state
    await prisma.bulkProject.update({
      where: { id: projectId },
      data: {
        status: 'ERROR',
      },
    });

    return {
      projectId,
      status: 'ERROR',
      findingsCount: 0,
      error: errorMessage,
    };
  }
}

/**
 * Fetch skills for contract analysis
 */
async function fetchContractSkills(params: {
  skillIds: string[];
  libraryId: LibraryId;
  customerId: string | null;
}) {
  const { skillIds, libraryId, customerId } = params;

  // Fetch library skills
  const librarySkills = await prisma.buildingBlock.findMany({
    where: {
      id: { in: skillIds },
      libraryId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
  });

  // Fetch customer skills if applicable
  let customerSkills: typeof librarySkills = [];
  if (customerId) {
    customerSkills = await prisma.buildingBlock.findMany({
      where: {
        id: { in: skillIds },
        libraryId: 'customers',
        customerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
    });
  }

  const allSkills = [...librarySkills, ...customerSkills];

  return { allSkills, librarySkills, customerSkills };
}
