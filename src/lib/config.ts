// Centralized configuration for the application

// LLM Parameters - centralized to avoid magic numbers
export const LLM_PARAMS = {
  // Max tokens for response generation
  maxTokens: 16000,
  // Temperature settings by use case
  temperature: {
    // Lower = more focused/deterministic (for structured output like skill drafts)
    precise: 0.1,
    // Default = balanced (for Q&A, chat, general responses)
    balanced: 0.2,
  },
} as const;

// Claude models for LLM calls
// Sonnet 4: Best quality (~10-30s) - use for complex analysis, RFP answering
// Haiku: Fast and cheap (~2-5s) - use for quick Q&A, simple tasks
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
export const CLAUDE_MODEL_FAST = process.env.CLAUDE_MODEL_FAST || "claude-3-5-haiku-20241022";

// Model selection helper
export type ModelSpeed = "fast" | "quality";

export function getModel(speed: ModelSpeed = "quality"): string {
  return speed === "fast" ? CLAUDE_MODEL_FAST : CLAUDE_MODEL;
}

// LLM Feature identifiers - used for speed defaults and preferences
export type LLMFeature =
  | "chat"              // Knowledge chat / The Oracle
  | "questions"         // Quick questions on home page
  | "questions-batch"   // Bulk RFP question processing
  | "skills-suggest"    // Skill generation/update
  | "skills-analyze"    // Analyze URLs for skill routing
  | "skills-analyze-rfp"    // Analyze RFP for skill suggestions
  | "skills-analyze-library" // Library health analysis
  | "skills-refresh"    // Refresh skill from sources
  | "customers-analyze" // Analyze URLs for customer matching
  | "customers-suggest" // Generate customer profiles
  | "customers-build"   // Build profile from documents
  | "contracts-analyze" // Contract clause analysis
  | "prompts-optimize"  // Prompt optimization suggestions
  | "documents-template"; // Generate document templates

// System defaults for LLM speed per feature
// "quality" = Sonnet (slower, more nuanced) - use for user-facing, accuracy-critical tasks
// "fast" = Haiku (faster, cheaper) - use for internal triage, suggestions, iterative tasks
export const LLM_SPEED_DEFAULTS: Record<LLMFeature, ModelSpeed> = {
  "chat": "quality",              // User-facing, needs nuance and anti-hallucination
  "questions": "quality",         // Accuracy critical for questionnaires
  "questions-batch": "quality",   // Accuracy critical for bulk RFP processing
  "skills-suggest": "quality",    // Skill content needs quality - users rely on accuracy
  "skills-analyze": "fast",       // Quick triage of new sources
  "skills-analyze-rfp": "quality", // Complex RFP analysis needs depth
  "skills-analyze-library": "fast", // Library organization is iterative
  "skills-refresh": "quality",    // Content accuracy matters
  "customers-analyze": "fast",    // Initial customer lookup/enrichment
  "customers-suggest": "fast",    // Quick suggestions
  "customers-build": "quality",   // Profile creation needs depth
  "contracts-analyze": "quality", // Legal/compliance - accuracy critical
  "prompts-optimize": "fast",     // Prompt iteration is quick
  "documents-template": "quality", // User-facing output
};

// Get effective speed for a feature, considering user override and request override
export function getEffectiveSpeed(
  feature: LLMFeature,
  requestOverride?: boolean,  // quickMode from request body
  userOverrides?: Record<string, ModelSpeed> | null,  // from user preferences
): ModelSpeed {
  // Request-level override takes highest priority (UI toggle)
  if (requestOverride === true) return "fast";
  if (requestOverride === false) return "quality";

  // User preference override
  if (userOverrides && userOverrides[feature]) {
    return userOverrides[feature];
  }

  // System default
  return LLM_SPEED_DEFAULTS[feature];
}

// Get max output tokens for a given model speed
// Used consistently across all LLM calls to ensure responses aren't truncated
// Both Sonnet and Haiku support 64k output, but we cap at 16k for practical use:
// - RFP batches: 20 questions × ~600 tokens = ~12k output
// - Single questions: ~1-2k output
// - Skill matching: ~5-10k output
// Higher values trigger Anthropic's "streaming required" for long operations
export function getMaxTokensForSpeed(speed?: ModelSpeed | null): number {
  void speed; // Same limit for both models - output size is task-dependent, not model-dependent
  return 16384;
}
