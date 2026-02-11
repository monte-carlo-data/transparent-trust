/**
 * V2 Collateral Prompt Blocks
 *
 * Blocks for generating collateral with structured placeholder output.
 */

import type { PromptBlock } from '../types';

export const collateralBlocks: PromptBlock[] = [
  // ==========================================================================
  // COLLATERAL PLACEHOLDER FORMAT
  // ==========================================================================
  {
    id: 'collateral_placeholder_format',
    name: 'Collateral Placeholder Format',
    description: 'Output format for generating placeholder values for templates.',
    tier: 2,
    content: `## OUTPUT FORMAT

You will generate content for template placeholders. Return a JSON object where:
- Each key is a placeholder name (without the {{ }} brackets)
- Each value is the content to fill in for that placeholder

IMPORTANT RULES:
1. Keep placeholder values concise - they will appear in slides/documents
2. Use only the information available in the provided skills and sources
3. If information for a placeholder is not available, provide a reasonable placeholder like "[Not Available]"
4. Format numbers, dates, and metrics appropriately for presentation
5. Do not include markdown formatting in values unless specifically requested

Example output:
{
  "CustomerName": "Acme Corporation",
  "ContractValue": "$1.2M ARR",
  "KeyMetric": "40% efficiency improvement",
  "NextSteps": "• Expand to European markets\\n• Deploy analytics module"
}`,
  },

  // ==========================================================================
  // COLLATERAL PLACEHOLDER GUIDE INJECTION
  // ==========================================================================
  {
    id: 'collateral_placeholder_guide',
    name: 'Collateral Placeholder Guide',
    description: 'Injects the placeholder guide describing what each placeholder should contain.',
    tier: 2,
    content: `## PLACEHOLDER GUIDE

Below are the placeholders you need to fill and what content each should contain:

{{PLACEHOLDER_GUIDE}}

Generate appropriate content for EACH placeholder listed above.`,
  },
];
