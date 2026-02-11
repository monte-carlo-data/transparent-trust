/**
 * Mode-Specific Task Blocks
 *
 * Task framing blocks for foundational skills and different refresh modes.
 * These define alternative WHAT TO DO instructions for different skill creation patterns.
 *
 * Tier 2 (Caution) - Important for accuracy, customize carefully
 */

import type { PromptBlock } from '../types';

// =============================================================================
// FOUNDATIONAL CREATION MODE
// =============================================================================

export const taskFramingFoundationalCreationBlock: PromptBlock = {
  id: 'task_framing_foundational_creation',
  name: 'Task: Foundational Skill Creation (Extract Mode)',
  description: 'Step-by-step instructions for creating a foundational skill by extracting only scope-relevant content.',
  tier: 2,
  content: `TASK: CREATE FOUNDATIONAL SKILL (EXTRACTION MODE)

You are creating a foundational skill where the user has already defined the scope.
Your job is to EXTRACT only the portions of the source materials that are relevant to the defined scope.

IMPORTANT: This is NOT a synthesis task. Extract relevant excerpts, don't synthesize everything.

STEP-BY-STEP PROCESS:

1. **Understand the foundational scope**
   - Review the pre-defined scope: what this skill covers and what it explicitly excludes
   - This scope acts as a FILTER - only extract content that matches it

2. **Review sources with scope as filter**
   - Read through all provided source materials
   - For each source, identify ONLY the portions that are relevant to the scope
   - Ignore content that falls outside the scope definition
   - If a source has no relevant content for this scope, skip it entirely

3. **Extract (don't synthesize)**
   - Pull relevant excerpts, facts, and details that match the scope
   - Maintain source fidelity - use exact terminology and phrasing when possible
   - Don't create summaries - extract the actual content
   - Don't synthesize information from multiple sources unless they're describing the same fact

4. **Create inline citations**
   - Assign a unique number to each source: [1], [2], [3], etc.
   - Add citations after facts from specific sources
   - Examples: "Feature X is available. [1]" or "Version 2.0 was released in May. [2]"

5. **Detect contradictions**
   - If sources contradict each other about scope-relevant content, note it
   - Include severity and recommendation for resolution

6. **Structure the content**
   - Main skill body with extracted facts and inline citations
   - ## Scope Definition section (use the provided foundational scope)
   - ## Common Questions section with Q&A relevant to the scope
   - ## Sources section listing all sources with [1], [2] references

7. **Return valid JSON**
   - Match the expected output schema exactly
   - Include only content relevant to the scope
   - All strings properly escaped
   - No text before or after JSON`,
};

// =============================================================================
// FOUNDATIONAL UPDATE MODE (ADDITIVE)
// =============================================================================

export const taskFramingFoundationalUpdateBlock: PromptBlock = {
  id: 'task_framing_foundational_update',
  name: 'Task: Foundational Skill Update (Additive Extraction)',
  description: 'Step-by-step instructions for updating a foundational skill by extracting and appending new scope-relevant content.',
  tier: 2,
  content: `TASK: UPDATE FOUNDATIONAL SKILL (ADDITIVE EXTRACTION MODE)

You are updating an existing foundational skill by extracting relevant content from NEW sources only.
The skill already has content from previous sources - you're APPENDING new relevant content.

IMPORTANT: This is an additive update. Extract only what's new and relevant, then append it.
IMPORTANT: Do NOT modify the title or scope definition - preserve them exactly as provided.

STEP-BY-STEP PROCESS:

1. **Review the existing skill**
   - Understand current content and scope definition
   - Note which citation numbers are already in use ([1], [2], etc.)
   - Understand what information is already covered

2. **Review new sources with scope as filter**
   - Apply the scope definition as a filter to the new sources
   - For each new source, identify ONLY the portions relevant to the scope
   - Ignore content that falls outside the scope
   - Skip sources with no relevant content

3. **Extract new information**
   - Pull relevant excerpts, facts, and details from new sources
   - Focus on information NOT already in the existing skill
   - If a new source provides an update to existing info, note that
   - Don't duplicate what's already there

4. **Preserve existing content**
   - Keep all existing content intact
   - DO NOT change existing citation numbers - they must remain exactly as they are
   - Existing [1] stays [1], existing [2] stays [2], etc.

5. **Assign new citations**
   - Assign new sequential numbers ONLY to new sources
   - Example: If existing has [1] and [2], new sources get [3], [4], etc.
   - Add citations after extracted facts: "New feature Y is available. [3]"

6. **Append extracted content**
   - Add new extracted content to relevant sections
   - If a section doesn't exist, create it
   - Maintain the existing structure and flow
   - Clearly integrate new content without disrupting existing information

7. **Detect contradictions**
   - Compare new sources with existing content
   - Note any conflicting information with severity and recommendation

8. **Report what changed**
   - List sections where content was appended
   - List new citations added
   - Note any contradictions found
   - Summarize what new information was extracted

9. **Return valid JSON**
   - Match the expected output schema exactly
   - Include the full updated content (existing + new)
   - Do NOT include title or scopeDefinition in output (they are preserved automatically)
   - All strings properly escaped
   - No text before or after JSON`,
};

// =============================================================================
// EXPORTS
// =============================================================================

export const modeTaskBlocks: PromptBlock[] = [
  taskFramingFoundationalCreationBlock,
  taskFramingFoundationalUpdateBlock,
];
