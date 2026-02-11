/**
 * V2 Chat & RFP Prompt Compositions
 *
 * Compositions for chat (CL-004) and RFP (CL-005) LLM calls.
 * These assemble the actual system prompts sent to Claude.
 */

import type { PromptComposition } from '../types';

export const chatRfpCompositions: PromptComposition[] = [
  // ==========================================================================
  // CHAT RESPONSE - CL-004: answerQuestionWithPrompt
  // ==========================================================================
  {
    context: 'chat_response',
    name: 'Chat Response',
    description: 'Answer questions using skill library with structured output format (CL-004).',
    category: 'chat_rfp',
    usedBy: [
      { feature: 'Chat', location: '/v2/chat', type: 'ui' },
      { feature: 'Chat API', location: '/api/v2/chat', type: 'api' },
      { feature: 'Collateral', location: '/v2/collateral', type: 'ui' },
    ],
    blockIds: [
      'role_questionnaire_specialist',  // Role & Mission
      'source_priority',                 // Source Priority + Conflict Resolution + Synthesis
      'quality_checks',                  // Quality Rules
      'confidence_levels',               // Confidence Levels with scope check
      'output_format_qa',                // Output Format with headers
      'source_fidelity',                 // Added: source verification
    ],
    outputFormat: 'text',
    outputSchema: undefined,
  },

  // ==========================================================================
  // RFP SINGLE QUESTION - CL-005
  // ==========================================================================
  {
    context: 'rfp_single',
    name: 'RFP Single Question',
    description: 'Answer individual RFP/questionnaire questions with JSON format (CL-005 single).',
    category: 'chat_rfp',
    usedBy: [
      { feature: 'RFP Processing', location: '/api/v2/projects/[id]/process-batch', type: 'api' },
    ],
    blockIds: [
      'role_rfp_specialist',             // Role & Mission for RFP
      'rfp_source_priority',             // Source Priority + Conflict Resolution
      'rfp_quality_checks',              // Quality validation rules
      'scope_validation',                // Scope validation (product vs internal)
      'rfp_confidence_levels',           // Confidence levels with detailed definitions
      'json_output',                     // CRITICAL: Return ONLY JSON, no markdown
      'rfp_single_question_schema',      // JSON schema for single question
      'source_fidelity',                 // Added: source verification
    ],
    outputFormat: 'json',
    outputSchema: 'RFPQuestionResponse',
  },

  // ==========================================================================
  // RFP BATCH QUESTIONS - CL-005
  // ==========================================================================
  {
    context: 'rfp_batch',
    name: 'RFP Batch Questions',
    description: 'Answer multiple RFP questions returning JSON array (CL-005 batch).',
    category: 'chat_rfp',
    usedBy: [
      { feature: 'RFP Wizard', location: '/v2/rfps', type: 'ui' },
      { feature: 'RFP Batch API', location: '/api/v2/projects/[id]/process-batch', type: 'api' },
    ],
    blockIds: [
      'role_rfp_specialist',             // Role & Mission for RFP
      'rfp_source_priority',             // Source Priority + Conflict Resolution
      'rfp_quality_checks',              // Quality validation rules
      'scope_validation',                // Scope validation (product vs internal)
      'rfp_confidence_levels',           // Confidence levels with detailed definitions
      'batch_json_instruction',          // Batch processing instruction
      'rfp_batch_questions_schema',      // JSON schema for batch questions
      'source_fidelity',                 // Added: source verification
    ],
    outputFormat: 'json',
    outputSchema: 'RFPBatchResponse',
  },

  // ==========================================================================
  // RFP SKILL MATCHING
  // ==========================================================================
  {
    context: 'rfp_skill_matching',
    name: 'RFP Skill Matching',
    description: 'Match RFP question clusters to relevant skills based on scope definitions.',
    category: 'chat_rfp',
    usedBy: [
      { feature: 'RFP Skill Preview', location: '/api/v2/projects/[id]/preview-skills', type: 'api' },
    ],
    blockIds: [
      'json_output',                     // JSON-only output
      'source_fidelity',                 // Accuracy rules
    ],
    outputFormat: 'json',
    outputSchema: undefined,
  },

  // ==========================================================================
  // RFP CLUSTER CREATION
  // ==========================================================================
  {
    context: 'rfp_cluster_creation',
    name: 'RFP Cluster Creation',
    description: 'Group questions semantically and match skills to each cluster in one call.',
    category: 'chat_rfp',
    usedBy: [
      { feature: 'RFP Clustering', location: 'question-scope-matcher.ts', type: 'internal' },
    ],
    blockIds: [
      'json_output',                     // JSON-only output
      'source_fidelity',                 // Accuracy rules
    ],
    outputFormat: 'json',
    outputSchema: undefined,
  },
];
