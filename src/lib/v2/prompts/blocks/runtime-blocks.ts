/**
 * V2 Runtime Prompt Blocks
 *
 * These blocks represent runtime modifications to base prompts.
 * They're exposed as editable blocks so admins can control behavior
 * without touching code.
 *
 * These blocks are conditionally included based on runtime context
 * (e.g., if callMode=true, the callModeBlock is included).
 */

import type { PromptBlock } from '../types';

export const callModeBlock: PromptBlock = {
  id: 'runtime_call_mode',
  name: 'Call Mode Modifier',
  description: 'Ultra-brief response mode for phone/voice calls (modifies base prompt)',
  tier: 3,
  content: `CALL MODE - ACTIVE:
You are in CALL MODE. Provide ultra-brief, direct answers only.
- No explanations, no context, no elaboration
- Maximum 2-3 sentences
- Get straight to the point
- Omit pleasantries and qualifiers`,
};

export const userInstructionsBlock: PromptBlock = {
  id: 'runtime_user_instructions',
  name: 'User Instructions',
  description: 'Custom instructions provided by the user at runtime',
  tier: 3,
  content: '', // Will be replaced with actual user instructions
};

export const runtimeBlocks = [
  callModeBlock,
  userInstructionsBlock,
];
