/**
 * Skill Generation Orchestrator
 *
 * Routes skill operations to the correct service based on creation/refresh mode.
 * This is the main entry point for all skill generation operations.
 *
 * Mode decision matrix:
 * - creationMode='generated' → Standard synthesis-based creation/update
 * - creationMode='foundational' → Extraction-based creation
 * - refreshMode='regenerative' → Reprocess all sources (default)
 * - refreshMode='additive' → Process only new sources and append
 */

import type { LibraryId, CreationMode, RefreshMode, SkillType } from '@/types/v2';
import type { SkillCreationOutput, SkillUpdateOutput, FoundationalCreationOutput } from '../prompts/types';
import { generateSkill as generateStandardSkill, updateSkill as updateStandardSkill } from './skill-generation-service';
import { generateFoundationalSkill } from './modes/foundational-service';

// =============================================================================
// TYPES
// =============================================================================

interface BaseSkillInput {
  libraryId: LibraryId;
  modelSpeed?: 'quality' | 'fast';
  customerId?: string;
  skillType?: SkillType;
}

interface CreateSkillInput extends BaseSkillInput {
  sources: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    content: string;
  }>;
  creationMode: CreationMode;
  /** For foundational mode, the skill title and pre-defined scope */
  title?: string;
  scopeDefinition?: {
    covers: string;
    futureAdditions: string[];
    notIncluded?: string[];
  };
}

interface UpdateSkillInput extends BaseSkillInput {
  existingSkill: {
    id: string;
    title: string;
    content: string;
    scopeDefinition?: {
      covers: string;
      futureAdditions: string[];
      notIncluded?: string[];
    };
    citations?: Array<{
      id: string;
      sourceId: string;
      label: string;
      url?: string;
    }>;
  };
  newSources: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    content: string;
  }>;
  refreshMode: RefreshMode;
  /** For regenerative mode, all incorporated sources */
  allSources?: Array<{
    id: string;
    type: string;
    label: string;
    url?: string;
    content: string;
  }>;
}

// =============================================================================
// ORCHESTRATOR FUNCTIONS
// =============================================================================

/**
 * Create a new skill using the appropriate service based on creationMode
 */
export async function createSkill(
  input: CreateSkillInput
): Promise<SkillCreationOutput | FoundationalCreationOutput> {
  // Derive skill type: foundational → intelligence, others → knowledge (or use explicit skillType)
  const skillType: SkillType = input.skillType || (input.creationMode === 'foundational' ? 'intelligence' : 'knowledge');

  if (input.creationMode === 'foundational') {
    // Foundational mode: Extract scope-relevant content only
    if (!input.scopeDefinition || !input.title) {
      throw new Error('Title and scope definition are required for foundational creation mode');
    }

    return generateFoundationalSkill({
      sources: input.sources,
      scopeDefinition: input.scopeDefinition,
      title: input.title,
      libraryId: input.libraryId,
      modelSpeed: input.modelSpeed,
      customerId: input.customerId,
      skillType,
    });
  } else {
    // Generated mode: Synthesize from all sources (default)
    return generateStandardSkill({
      sources: input.sources,
      libraryId: input.libraryId,
      skillType,
    });
  }
}

/**
 * Update an existing skill using the appropriate composition based on refreshMode
 */
export async function updateSkill(
  input: UpdateSkillInput
): Promise<SkillUpdateOutput> {
  // Derive skill type from input or use default
  const skillType: SkillType = input.skillType || 'knowledge';

  if (input.refreshMode === 'additive') {
    // Additive mode: Process only new sources and append
    return updateStandardSkill({
      existingSkill: input.existingSkill,
      newSources: input.newSources,
      libraryId: input.libraryId,
      isCustomerSkill: !!input.customerId,
      refreshMode: 'additive',
      skillType,
    });
  } else {
    // Regenerative mode: Reprocess all sources (default)
    if (!input.allSources) {
      throw new Error('All sources are required for regenerative refresh mode');
    }

    return updateStandardSkill({
      existingSkill: input.existingSkill,
      newSources: input.allSources, // For regenerative, "new" is actually all sources
      libraryId: input.libraryId,
      refreshMode: 'regenerative',
      skillType,
    });
  }
}

/**
 * Helper: Determine creation mode from skill attributes
 */
export function getCreationMode(attributes: Record<string, unknown> | null | undefined): CreationMode {
  if (!attributes) return 'generated';
  const mode = attributes.creationMode;
  if (mode === 'foundational') return 'foundational';
  return 'generated';
}

/**
 * Helper: Determine refresh mode from skill attributes
 */
export function getRefreshMode(attributes: Record<string, unknown> | null | undefined): RefreshMode {
  if (!attributes) return 'regenerative';
  const mode = attributes.refreshMode;
  if (mode === 'additive') return 'additive';
  return 'regenerative';
}
