/**
 * V2 Collateral Prompt Compositions
 *
 * Compositions for generating collateral with structured placeholder output.
 * Used for Google Slides and other template-based exports.
 */

import type { PromptComposition } from '../types';

export const collateralCompositions: PromptComposition[] = [
  // ==========================================================================
  // COLLATERAL PLACEHOLDER GENERATION
  // ==========================================================================
  {
    context: 'collateral_placeholder_generation',
    name: 'Collateral Placeholder Generation',
    description: 'Generate content for template placeholders based on skills and sources.',
    category: 'collateral',
    usedBy: [
      { feature: 'Collateral Export', location: '/api/v2/collateral/generate', type: 'api' },
      { feature: 'Google Slides Export', location: '/v2/collateral', type: 'ui' },
    ],
    blockIds: [
      'role_questionnaire_specialist',   // Role & Mission
      'source_priority',                  // Source Priority
      'collateral_placeholder_format',    // Placeholder output format
      'source_fidelity',                  // Source verification
    ],
    outputFormat: 'json',
    outputSchema: 'CollateralPlaceholders',
  },
];
