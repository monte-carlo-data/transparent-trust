/**
 * Foundational Skills Template Service
 *
 * Handles cloning foundational skills to customers.
 * A foundational skill acts as a template that can be applied to multiple customers.
 *
 * Cloning process:
 * - Copy title and scope definition (scopeDefinition)
 * - Set creationMode='foundational' and refreshMode='additive'
 * - Start with empty content (sources will populate it)
 * - Link back to source via clonedFrom attribute
 */

import { prisma } from '@/lib/prisma';
import type { LibraryId } from '@/types/v2';
import { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

interface CloneFoundationalSkillInput {
  /** The foundational skill to clone */
  sourceSkillId: string;
  /** Customer IDs to clone to (can clone to multiple at once) */
  customerIds: string[];
  /** User performing the clone */
  userId: string;
  userName?: string;
  userEmail?: string;
}

interface CloneResult {
  sourceSkillId: string;
  sourceSkillTitle: string;
  clonedSkills: Array<{
    id: string;
    customerId: string;
    title: string;
  }>;
  errors: Array<{
    customerId: string;
    error: string;
  }>;
}

// =============================================================================
// CLONE OPERATIONS
// =============================================================================

/**
 * Clone a foundational skill to one or more customers
 */
export async function cloneFoundationalSkill(
  input: CloneFoundationalSkillInput
): Promise<CloneResult> {
  // Fetch the source skill
  const sourceSkill = await prisma.buildingBlock.findUnique({
    where: { id: input.sourceSkillId },
  });

  if (!sourceSkill) {
    throw new Error(`Source skill not found: ${input.sourceSkillId}`);
  }

  const sourceAttrs = (sourceSkill.attributes as Record<string, unknown>) || {};

  // Verify it's a foundational skill
  if (!sourceAttrs.isFoundational) {
    throw new Error('Only foundational skills can be cloned');
  }

  const scopeDefinition = sourceAttrs.scopeDefinition as {
    covers: string;
    futureAdditions: string[];
    notIncluded: string[];
  } | undefined;

  if (!scopeDefinition) {
    throw new Error('Foundational skill must have scope definition');
  }

  // Clone to each customer
  const clonedSkills: Array<{
    id: string;
    customerId: string;
    title: string;
  }> = [];
  const errors: Array<{
    customerId: string;
    error: string;
  }> = [];

  for (const customerId of input.customerIds) {
    try {
      // Check if customer exists
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        errors.push({
          customerId,
          error: 'Customer not found',
        });
        continue;
      }

      // Generate slug for this customer
      const slug = sourceSkill.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);

      // Check if this customer already has a skill with this slug
      const existing = await prisma.buildingBlock.findFirst({
        where: {
          libraryId: 'customers',
          customerId,
          slug,
        },
      });

      if (existing) {
        errors.push({
          customerId,
          error: `Skill with slug "${slug}" already exists for this customer`,
        });
        continue;
      }

      // Create the cloned skill with empty content
      const clonedAttributes: Record<string, unknown> = {
        creationMode: 'foundational',
        refreshMode: 'additive',
        isFoundational: false,  // Clones are not foundational themselves
        clonedFrom: input.sourceSkillId,
        scopeDefinition,
        auditLog: {
          entries: [
            {
              action: 'created',
              timestamp: new Date().toISOString(),
              userId: input.userId,
              userName: input.userName,
              userEmail: input.userEmail,
              summary: `Cloned from foundational skill: ${sourceSkill.title}`,
            },
          ],
        },
      };

      const cloned = await prisma.buildingBlock.create({
        data: {
          title: sourceSkill.title,
          slug,
          content: '', // Start empty - sources will populate
          summary: `${sourceSkill.title} for ${customer.company || 'this customer'}`,
          libraryId: 'customers' as LibraryId,
          customerId,
          blockType: 'knowledge',
          skillType: 'intelligence', // Foundational skills are intelligence-type
          status: 'ACTIVE',
          teamId: sourceSkill.teamId,
          ownerId: input.userId,
          attributes: clonedAttributes as Prisma.InputJsonValue,
        },
      });

      clonedSkills.push({
        id: cloned.id,
        customerId,
        title: cloned.title,
      });
    } catch (error) {
      console.error('[TemplateService] Failed to clone to customer %s:', customerId, error);
      errors.push({
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    sourceSkillId: input.sourceSkillId,
    sourceSkillTitle: sourceSkill.title,
    clonedSkills,
    errors,
  };
}

/**
 * List all foundational skills (candidates for cloning)
 *
 * Note: Foundational skills are global templates - they are NOT filtered by teamId.
 * This allows templates created by any team to be available for cloning to any customer.
 * The teamId parameter is kept for backwards compatibility but is intentionally ignored.
 */
export async function listFoundationalSkills(): Promise<Array<{
  id: string;
  title: string;
  slug: string;
  libraryId: LibraryId;
  scopeDefinition: {
    covers: string;
    futureAdditions: string[];
    notIncluded: string[];
  };
  createdAt: Date;
}>> {
  // Foundational skills are global templates - no team filtering
  const where: Prisma.BuildingBlockWhereInput = {
    status: 'ACTIVE',
    customerId: null, // Only get templates, not customer-specific instances
  };

  const skills = await prisma.buildingBlock.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Filter for foundational skills
  const foundational = skills
    .filter(skill => {
      const attrs = (skill.attributes as Record<string, unknown>) || {};
      return attrs.isFoundational === true && attrs.scopeDefinition;
    })
    .map(skill => {
      const attrs = (skill.attributes as Record<string, unknown>) || {};
      const scopeDefinition = attrs.scopeDefinition as {
        covers: string;
        futureAdditions: string[];
        notIncluded: string[];
      };

      return {
        id: skill.id,
        title: skill.title,
        slug: skill.slug || skill.id,
        libraryId: skill.libraryId as LibraryId,
        scopeDefinition,
        createdAt: skill.createdAt,
      };
    });

  return foundational;
}

/**
 * Get skills cloned from a specific foundational skill
 */
export async function getClonedSkills(
  sourceSkillId: string
): Promise<Array<{
  id: string;
  title: string;
  customerId: string;
  customerName?: string;
  status: string;
  createdAt: Date;
}>> {
  const clones = await prisma.buildingBlock.findMany({
    where: {
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  // Filter for clones of this source
  const filtered = clones.filter(skill => {
    const attrs = (skill.attributes as Record<string, unknown>) || {};
    return attrs.clonedFrom === sourceSkillId;
  });

  // Fetch customer names for each clone
  const customerIds = filtered.map(skill => skill.customerId).filter((id): id is string => !!id);
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, company: true },
  });

  const customerNameMap = new Map(customers.map(c => [c.id, c.company]));

  return filtered.map(skill => ({
    id: skill.id,
    title: skill.title,
    customerId: skill.customerId || '',
    customerName: skill.customerId ? customerNameMap.get(skill.customerId) || undefined : undefined,
    status: skill.status,
    createdAt: skill.createdAt,
  }));
}
