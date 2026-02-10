/**
 * Skill Task Blocks
 *
 * Task framing blocks that define WHAT TO DO for each skill operation.
 * These contain the step-by-step instructions that were previously duplicated
 * in user prompt templates.
 *
 * Tier 2 (Caution) - Important for accuracy, customize carefully
 */

import type { PromptBlock } from '../types';

export const taskFramingCreationBlock: PromptBlock = {
  id: 'task_framing_creation',
  name: 'Task: Skill Creation',
  description: 'Step-by-step instructions for creating a new skill from sources.',
  tier: 2,
  content: `TASK: CREATE NEW SKILL

You are creating a new skill from scratch using the provided source materials.

STEP-BY-STEP PROCESS:

1. **Extract comprehensive knowledge**
   - Review all provided source materials
   - Identify all facts, specifications, capabilities, and details
   - Extract EVERYTHING of value - don't summarize or truncate

2. **Create inline citations**
   - Assign a unique number to each source: [1], [2], [3], etc.
   - Add citations after facts from specific sources
   - Examples: "Feature X is available. [1]" or "Version 2.0 was released in May. [2]"

3. **Define the scope**
   - What does this skill cover? (main topic and boundaries)
   - What should be added later? (natural future extensions)
   - What should NOT be in this skill? (prevent bloat)

4. **Detect contradictions**
   - Compare sources for conflicting information
   - If contradictions exist, note them with severity and recommendation

5. **Structure the content**
   - Main skill body with facts and inline citations
   - ## Scope Definition section with covers/futureAdditions/notIncluded
   - ## Common Questions section with important Q&A
   - ## Sources section listing all sources with [1], [2] references

6. **Return valid JSON**
   - Match the expected output schema exactly
   - All strings properly escaped
   - No text before or after JSON`,
};

export const taskFramingUpdateBlock: PromptBlock = {
  id: 'task_framing_update',
  name: 'Task: Skill Update',
  description: 'Step-by-step instructions for updating an existing skill with new sources.',
  tier: 2,
  content: `TASK: UPDATE EXISTING SKILL

You are updating an existing skill by integrating new source material.

STEP-BY-STEP PROCESS:

1. **Review the existing skill**
   - Understand current content, scope, and citations
   - Note which citation numbers are already in use ([1], [2], etc.)

2. **Review new sources against scope**
   - Check if new sources match the skill's scope definition
   - If a source matches, plan where to integrate it
   - If it's out of scope, still note contradictions found

3. **Preserve existing content**
   - Keep valuable existing content - don't remove without reason
   - Only modify what the new source warrants

4. **Handle citation numbering**
   - DO NOT change existing citation numbers - they must remain exactly as they are
   - Existing [1] stays [1], existing [2] stays [2], etc.
   - Assign new sequential numbers ONLY to new sources
   - Example: If existing has [1] and [2], new sources get [3], [4], etc.

5. **Verify citation accuracy**
   - Check that each [1], [2] reference in existing content is correct
   - If you find citation errors, fix them
   - Ensure every citation number has exactly one corresponding source

6. **Detect contradictions**
   - Compare existing content with new sources
   - Note any conflicting information with severity and recommendation

7. **Report what changed**
   - Sections added (from new sources)
   - Sections updated (modified by new sources)
   - Sections removed (if any - rare, explain why)
   - Citation fixes (if you corrected citation errors)

8. **Return valid JSON**
   - Match the expected output schema exactly
   - Include both existing and new citations
   - All strings properly escaped
   - No text before or after JSON`,
};

export const taskFramingMatchingBlock: PromptBlock = {
  id: 'task_framing_matching',
  name: 'Task: Skill Matching',
  description: 'Step-by-step instructions for matching a source to existing skills.',
  tier: 2,
  content: `TASK: MATCH SOURCE TO SKILLS

You are determining which existing skill(s) new source content belongs to.

STEP-BY-STEP PROCESS:

1. **Analyze the source content**
   - Read and understand the new source material
   - Identify its main topics and domains

2. **For each existing skill, check if it matches**
   - Does it match the "covers" description?
   - Does it fit in the "futureAdditions" criteria?
   - Is it NOT in the "notIncluded" list?
   - Assign confidence: high/medium/low

3. **Handle multiple matches**
   - One source can match MULTIPLE skills
   - Different aspects of the source may belong to different skills
   - Suggest excerpt to use for each match

4. **If no matches found**
   - Recommend creating a new skill
   - Suggest title and scope definition for the new skill

5. **Bias toward consolidation**
   - Strongly prefer matching existing skills
   - Only recommend new skills when truly necessary
   - Skills should be comprehensive chapters, not single pages

6. **Return valid JSON**
   - Match the expected output schema exactly
   - All strings properly escaped
   - No text before or after JSON`,
};

export const taskFramingFormatRefreshBlock: PromptBlock = {
  id: 'task_framing_format_refresh',
  name: 'Task: Skill Format Refresh',
  description: 'Step-by-step instructions for reformatting a skill to current standards.',
  tier: 2,
  content: `TASK: FORMAT REFRESH EXISTING SKILL

You are reformatting an existing skill to match current documentation standards.

STEP-BY-STEP PROCESS:

1. **ALWAYS regenerate the structure, not validate**
   - This is a format refresh - restructure the content to match current standards
   - Don't just check if existing format is acceptable and return it unchanged
   - Apply all current formatting rules and section organization
   - Focus: STRUCTURE and FORMATTING, not content accuracy (see step 2)

2. **Preserve all factual knowledge**
   - Keep ALL factual knowledge from the existing skill exactly as-is
   - DO NOT paraphrase, summarize, or change the facts
   - DO NOT remove or omit any content
   - You are reformatting, not rewriting content

3. **Integrate all source materials**
   - Use all incorporated sources to regenerate the skill
   - Ensure consistent citation numbering ([1], [2], [3], etc.)
   - Update citations for consistency and accuracy

4. **Ensure proper structure**
   - Main skill body with facts and inline citations
   - ## Scope Definition section with covers/futureAdditions/notIncluded
   - ## Common Questions section with important Q&A
   - ## Sources section listing all sources with [1], [2] references

5. **Report what changed structurally**
   - Sections added (new structure elements)
   - Sections updated (restructured or reformatted)
   - Sections removed (rare - explain why)
   - Focus on STRUCTURAL and FORMATTING changes, not content changes
   - If content is the same but restructured, that counts as "updated"

6. **Don't change accuracy**
   - DO NOT modify facts or content accuracy
   - DO NOT omit citations
   - DO NOT reduce comprehensiveness
   - ONLY improve formatting and structure

7. **Return valid JSON**
   - Match the expected output schema exactly
   - All strings properly escaped
   - No text before or after JSON`,
};

export const skillTaskBlocks: PromptBlock[] = [
  taskFramingCreationBlock,
  taskFramingUpdateBlock,
  taskFramingMatchingBlock,
  taskFramingFormatRefreshBlock,
];
