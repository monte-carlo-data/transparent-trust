/**
 * V2 Utility Prompt Compositions
 *
 * Compositions for utility/tool LLM calls (CL-009 prompt builder, CL-010 prompt optimizer).
 */

import type { PromptComposition } from '../types';

export const utilityCompositions: PromptComposition[] = [
  // ==========================================================================
  // PROMPT BUILDER
  // ==========================================================================
  {
    context: 'prompt_builder',
    name: 'Prompt Builder',
    description: 'Help users refine and improve prompts for AI systems (CL-009).',
    category: 'utility',
    usedBy: [
      { feature: 'Prompt Builder API', location: '/api/prompts/build', type: 'api' },
    ],
    blockIds: [
      'role_prompt_engineer',      // Prompt engineering expert role
      'prompt_analysis_rules',      // What to check in prompts
      'prompt_ready_markers',       // Output format markers for improved prompts
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },

  // ==========================================================================
  // PROMPT OPTIMIZER
  // ==========================================================================
  {
    context: 'prompt_optimize',
    name: 'Prompt Optimizer',
    description: 'Analyze prompts for token reduction while maintaining clarity (CL-010).',
    category: 'utility',
    usedBy: [
      { feature: 'Prompt Optimizer API', location: '/api/prompts/optimize', type: 'api' },
    ],
    blockIds: [
      'role_prompt_optimizer',           // Optimization specialist role
      'optimization_priorities',         // Priority levels for suggestions
      'optimization_output_format',      // JSON format for optimization results
    ],
    outputFormat: 'json',
    outputSchema: 'OptimizationSuggestions',
  },
];
