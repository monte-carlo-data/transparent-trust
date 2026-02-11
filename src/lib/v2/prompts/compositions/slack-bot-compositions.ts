/**
 * V2 Slack Bot Prompt Compositions
 *
 * Compositions for Slack bot LLM calls (CL-002).
 * Each library (IT, Knowledge, GTM) has its own composition with library-specific role.
 */

import type { PromptComposition } from '../types';

export const slackBotCompositions: PromptComposition[] = [
  // ==========================================================================
  // SLACK BOT - IT LIBRARY
  // ==========================================================================
  {
    context: 'slack_bot_it',
    name: 'Slack Bot - IT Support',
    description: 'Slack bot for IT library answering support questions (CL-002 it_bot).',
    category: 'slack_bots',
    usedBy: [
      { feature: 'IT Slack Bot', location: '/api/v2/integrations/slack/it', type: 'api' },
    ],
    blockIds: [
      'role_slack_bot_it',           // IT-specific role
      'slack_bot_output_format',     // Output format for Slack responses
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },

  // ==========================================================================
  // SLACK BOT - KNOWLEDGE LIBRARY
  // ==========================================================================
  {
    context: 'slack_bot_knowledge',
    name: 'Slack Bot - Knowledge Assistant',
    description: 'Slack bot for Knowledge library answering general questions (CL-002 knowledge_bot).',
    category: 'slack_bots',
    usedBy: [
      { feature: 'Knowledge Slack Bot', location: '/api/v2/integrations/slack/knowledge', type: 'api' },
    ],
    blockIds: [
      'role_slack_bot_knowledge',    // Knowledge-specific role
      'slack_bot_output_format',     // Output format for Slack responses
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },

  // ==========================================================================
  // SLACK BOT - GTM LIBRARY
  // ==========================================================================
  {
    context: 'slack_bot_gtm',
    name: 'Slack Bot - GTM Specialist',
    description: 'Slack bot for GTM library providing go-to-market insights (CL-002 gtm_bot).',
    category: 'slack_bots',
    usedBy: [
      { feature: 'GTM Slack Bot', location: '/api/v2/integrations/slack/gtm', type: 'api' },
    ],
    blockIds: [
      'role_slack_bot_gtm',          // GTM-specific role
      'slack_bot_output_format',     // Output format for Slack responses
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },

  // ==========================================================================
  // SLACK BOT - TALENT LIBRARY
  // ==========================================================================
  {
    context: 'slack_bot_talent',
    name: 'Slack Bot - Talent Acquisition',
    description: 'Slack bot for Talent library answering recruiting questions (CL-002 talent_bot).',
    category: 'slack_bots',
    usedBy: [
      { feature: 'Talent Slack Bot', location: '/api/v2/integrations/slack/talent', type: 'api' },
    ],
    blockIds: [
      'role_slack_bot_talent',       // Talent-specific role
      'slack_bot_output_format',     // Output format for Slack responses
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },
];
