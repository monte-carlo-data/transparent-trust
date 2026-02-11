/**
 * Centralized constants for the application.
 * This file consolidates magic numbers, storage keys, and configuration values.
 */

// =============================================================================
// INPUT LIMITS
// =============================================================================

export const INPUT_LIMITS = {
  /** Maximum characters for chat input */
  CHAT_MESSAGE: 10000,
  /** Maximum characters for URL input fields */
  URL_INPUT: 10000,
  /** Maximum characters for skill/document content */
  CONTENT_MAX: 100000,
  /** Maximum characters for notes fields */
  NOTES_MAX: 10000,
  /** Maximum characters for question text */
  QUESTION_MAX: 10000,
} as const;

// =============================================================================
// CONTEXT SIZE THRESHOLDS
// =============================================================================

export const CONTEXT_LIMITS = {
  /** Context size (chars) at which to show warning in chat sidebar */
  WARNING_THRESHOLD: 100000,
  /** Maximum context size for API requests */
  MAX_CONTEXT: 100000,
  /** Character budget for skills in knowledge chat */
  skills: 40000,
  /** Character budget for documents in knowledge chat */
  documents: 30000,
  /** Character budget for URLs in knowledge chat */
  urls: 20000,
} as const;

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  // User preferences
  USER_INSTRUCTIONS: "grc-minion-user-instructions",

  // Prompt storage
  SKILL_PROMPT: "grc-minion-skill-prompt",
  QUESTION_PROMPT: "grc-minion-question-prompt",
  CHAT_SYSTEM_PROMPT: "grc-minion-chat-system-prompt",

  // Prompt sections
  QUESTION_PROMPT_SECTIONS: "grc-minion-question-prompt-sections",
  SKILL_PROMPT_SECTIONS: "grc-minion-skill-prompt-sections",
  CHAT_PROMPT_SECTIONS: "grc-minion-chat-prompt-sections",
  LIBRARY_ANALYSIS_SECTIONS: "grc-minion-library-analysis-sections",

  // Chat features
  CHAT_PROMPTS: "grc-minion-chat-prompts",
  CHAT_PROJECT_TEMPLATES: "grc-minion-chat-project-templates",
  BUILTIN_PROMPT_OVERRIDES: "grc-minion-builtin-prompt-overrides",
  CUSTOM_CATEGORIES: "grc-minion-custom-categories",

  // Data storage
  SKILLS: "grc-minion-skills",
  PROMPT_VERSION: "grc-minion-prompt-version",
} as const;

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULTS = {
  USER_INSTRUCTIONS: `You are a helpful assistant. Be professional but conversational. Use bullet points or numbered lists for complex information. Be concise but thorough.`,
} as const;

// =============================================================================
// UI CONSTANTS
// =============================================================================

export const UI = {
  /** Debounce delay for search inputs (ms) */
  SEARCH_DEBOUNCE: 300,
  /** Animation duration for highlights (ms) */
  HIGHLIGHT_DURATION: 3000,
  /** Scroll delay after navigation (ms) */
  SCROLL_DELAY: 100,
} as const;

// =============================================================================
// API LIMITS
// =============================================================================

export const API_LIMITS = {
  /** Maximum chat sessions to fetch in history */
  CHAT_HISTORY_LIMIT: 20,
  /** Maximum URLs to process in bulk */
  BULK_URL_LIMIT: 20,
  /** Characters per URL in bulk processing */
  URL_CHAR_LIMIT: 20000,
  /** Total characters for bulk URL processing */
  BULK_TOTAL_CHAR_LIMIT: 100000,
} as const;

// =============================================================================
// SKILL VOLUME LIMITS
// =============================================================================

export const SKILL_VOLUME = {
  /** Character count at which to warn about large skill groups */
  WARNING_THRESHOLD: 15000,
  /** Character count at which to recommend splitting into multiple skills */
  SPLIT_THRESHOLD: 20000,
  /** Minimum sources required to trigger split analysis */
  MIN_SOURCES_FOR_SPLIT: 3,
  /** Maximum sources per skill before recommending a split */
  MAX_SOURCES_PER_SKILL: 5,
} as const;
