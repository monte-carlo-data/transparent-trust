/**
 * V2 Prompt Compositions
 *
 * SINGLE SOURCE OF TRUTH for all LLM prompt compositions.
 * All consumers (registry, admin UI) should import from here.
 *
 * To add a new composition:
 * 1. Create or update a composition file in this directory
 * 2. Import and add to allCompositions below
 * 3. It will automatically appear in registry and admin UI
 */

// Re-export individual composition modules for direct access
export * from './skill-compositions';
export * from './customer-view-compositions';
export * from './contract-analysis-compositions';
export * from './foundational-compositions';
export * from './chat-rfp-compositions';
export * from './slack-bot-compositions';
export * from './utility-compositions';
export * from './collateral-compositions';

// Import all composition arrays
import { skillCompositions } from './skill-compositions';
import { customerViewCompositions } from './customer-view-compositions';
import { contractAnalysisCompositions } from './contract-analysis-compositions';
import { foundationalCompositions } from './foundational-compositions';
import { chatRfpCompositions } from './chat-rfp-compositions';
import { slackBotCompositions } from './slack-bot-compositions';
import { utilityCompositions } from './utility-compositions';
import { collateralCompositions } from './collateral-compositions';
import type { PromptComposition, PromptContext } from '../types';

/**
 * All available compositions - THE source of truth
 *
 * Categories:
 * - Chat/RFP: chat_response, rfp_single, rfp_batch, rfp_skill_matching, rfp_cluster_creation
 * - Skills: skill_creation, skill_update, skill_matching, skill_format_refresh
 * - Foundational: foundational_creation, foundational_additive_update
 * - Slack Bots: slack_bot_it, slack_bot_knowledge, slack_bot_gtm, slack_bot_talent
 * - Customer Views: customer_revenue_forecast, customer_competitive_analysis, customer_risk_assessment, customer_expansion_opportunities
 * - Contract: contract_analysis
 * - Utility: prompt_builder, prompt_optimize
 */
export const allCompositions: PromptComposition[] = [
  // Chat & RFP (CL-004, CL-005)
  ...chatRfpCompositions,

  // Skill operations (CL-006, CL-007, CL-008)
  ...skillCompositions,

  // Foundational skills
  ...foundationalCompositions,

  // Slack bots (CL-002)
  ...slackBotCompositions,

  // Customer analysis views
  ...customerViewCompositions,

  // Contract analysis
  ...contractAnalysisCompositions,

  // Utility (CL-009, CL-010)
  ...utilityCompositions,

  // Collateral generation
  ...collateralCompositions,
];

/**
 * Get a composition by context
 * @throws Error if composition not found (fail-fast, no silent fallbacks)
 */
export function getComposition(context: PromptContext): PromptComposition {
  const composition = allCompositions.find(c => c.context === context);
  if (!composition) {
    const available = allCompositions.map(c => c.context).join(', ');
    throw new Error(`Unknown composition: "${context}". Available: ${available}`);
  }
  return composition;
}

/**
 * Get a composition by context, or undefined if not found
 * Use this for optional lookups; use getComposition() for required lookups
 */
export function findComposition(context: PromptContext): PromptComposition | undefined {
  return allCompositions.find(c => c.context === context);
}
