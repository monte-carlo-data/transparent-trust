/**
 * Preview Skills API (No Clustering)
 *
 * GET /api/v2/projects/[projectId]/preview-skills
 *
 * Returns skill recommendations for ALL questions without clustering.
 * User selects skills + batch size, then processes all questions with same skill set.
 *
 * Query parameters:
 * - libraryId: Which library to use (default: from project config, or 'knowledge')
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import prisma from '@/lib/prisma';
import {
  matchSkillsToAllQuestions,
  type QuestionInfo,
  type SkillInfo,
} from '@/lib/v2/rfp/question-scope-matcher';
import type { LibraryId } from '@/types/v2';
import { estimateTokens } from '@/lib/tokenUtils';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const searchParams = request.nextUrl.searchParams;
    const libraryIdParam = searchParams.get('libraryId') as LibraryId | null;

    // Verify project exists and user has access
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        status: true,
        config: true,
        fileContext: true,
        customerId: true,
        customer: {
          select: { id: true, company: true },
        },
        _count: {
          select: { rows: true },
        },
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      return errors.forbidden('Access denied');
    }

    const projectConfig = project.config as Record<string, unknown> | null;
    const libraryId: LibraryId =
      libraryIdParam || (projectConfig?.libraryId as LibraryId) || 'knowledge';

    logger.info('Starting skill preview (no clustering)', {
      projectId,
      projectName: project.name,
      questionCount: project._count.rows,
      libraryId,
    });

    // Fetch all questions
    const rows = await prisma.bulkRow.findMany({
      where: { projectId },
      select: {
        id: true,
        rowNumber: true,
        inputData: true,
      },
      orderBy: { rowNumber: 'asc' },
    });

    if (rows.length === 0) {
      return errors.badRequest('Project has no questions');
    }

    // Convert to QuestionInfo format
    const questions: QuestionInfo[] = rows.map(row => {
      const input = row.inputData as Record<string, unknown>;
      return {
        id: row.id,
        question: String(input.question || ''),
        context: input.context ? String(input.context) : undefined,
      };
    });

    // Fetch active skills from the library
    const dbSkills = await prisma.buildingBlock.findMany({
      where: {
        libraryId,
        status: 'ACTIVE',
        customerId: null, // Library skills only (not customer-specific)
      },
      select: {
        id: true,
        title: true,
        content: true,
        attributes: true,
      },
    });

    // Fetch customer skills if project is linked to a customer
    let customerSkills: typeof dbSkills = [];
    if (project.customerId) {
      customerSkills = await prisma.buildingBlock.findMany({
        where: {
          libraryId: 'customers',
          customerId: project.customerId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          content: true,
          attributes: true,
        },
      });
    }

    // Convert to SkillInfo format with scope
    const convertToSkillInfo = (skill: typeof dbSkills[number]): SkillInfo => {
      const attributes = skill.attributes as Record<string, unknown> | null;
      const scopeDefinition = attributes?.scopeDefinition as Record<string, unknown> | undefined;
      const covers = scopeDefinition?.covers as string | undefined;
      return {
        id: skill.id,
        title: skill.title,
        scopeCovers: covers || '(no scope defined)',
      };
    };

    const skills: SkillInfo[] = dbSkills.map(convertToSkillInfo);
    const customerSkillInfos: SkillInfo[] = customerSkills.map(convertToSkillInfo);
    const allSkillsForMatching = [...skills, ...customerSkillInfos];

    if (allSkillsForMatching.length === 0) {
      return errors.badRequest(`No skills found in library: ${libraryId}`);
    }

    // Call LLM to match skills to all questions (no clustering)
    const matchResult = await matchSkillsToAllQuestions({
      projectId,
      questions,
      skills: allSkillsForMatching,
      libraryId,
      fileContext: project.fileContext || undefined,
    });

    // Build skill details with estimated tokens
    const allDbSkills = [...dbSkills, ...customerSkills];
    const customerSkillIds = new Set(customerSkills.map(s => s.id));

    const skillDetails = matchResult.skills.map(skill => {
      const dbSkill = allDbSkills.find(s => s.id === skill.skillId);
      const skillContent = dbSkill?.content || '';
      const estimatedTokens = estimateTokens(skillContent);
      const isCustomerSkill = customerSkillIds.has(skill.skillId);

      return {
        skillId: skill.skillId,
        skillTitle: skill.skillTitle,
        confidence: skill.confidence,
        reason: skill.reason,
        scopeCovers: allSkillsForMatching.find(s => s.id === skill.skillId)?.scopeCovers || '',
        estimatedTokens,
        isCustomerSkill,
      };
    });

    // Calculate totals
    const highConfidenceSkills = skillDetails.filter(s => s.confidence === 'high');
    const mediumConfidenceSkills = skillDetails.filter(s => s.confidence === 'medium');
    const recommendedSkillIds = [...highConfidenceSkills, ...mediumConfidenceSkills].map(s => s.skillId);

    // Calculate actual token counts for questions (not hardcoded)
    const totalQuestionTokens = questions.reduce((sum, q) => {
      const questionText = q.context ? `${q.context} ${q.question}` : q.question;
      return sum + estimateTokens(questionText);
    }, 0);

    // Get actual system prompt token count from transparency
    const systemPromptTokens = matchResult.transparency.systemPrompt
      ? estimateTokens(matchResult.transparency.systemPrompt)
      : 2000; // Fallback estimate only if transparency unavailable

    logger.info('Skill preview complete (no clustering)', {
      projectId,
      totalSkills: skillDetails.length,
      highConfidence: highConfidenceSkills.length,
      mediumConfidence: mediumConfidenceSkills.length,
      questionCount: questions.length,
      totalQuestionTokens,
      systemPromptTokens,
    });

    return apiSuccess({
      success: true,
      data: {
        projectId,
        projectName: project.name,
        libraryId,

        // Customer info (if linked)
        customer: project.customer
          ? { id: project.customer.id, company: project.customer.company }
          : null,

        // Question info
        questionCount: questions.length,
        questions: questions.slice(0, 20), // Preview first 20

        // All skills ranked by confidence (includes isCustomerSkill flag)
        skills: skillDetails,

        // Recommended skill IDs (high + medium confidence)
        recommendedSkillIds,

        // Token counts - calculated from actual content, not hardcoded
        tokenCounts: {
          systemPrompt: systemPromptTokens,
          totalQuestions: totalQuestionTokens,
          totalSkills: skillDetails.reduce((sum, s) => sum + s.estimatedTokens, 0),
        },

        // Transparency
        transparency: matchResult.transparency,
      },
    });
  } catch (error) {
    logger.error('Failed to preview skills', error, {
      projectId,
      route: '/api/v2/projects/[id]/preview-skills',
    });

    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }

    return errors.internal('Failed to preview skills');
  }
}
