/**
 * Skill Output Blocks
 *
 * Output format and content structure blocks that define HOW skills should be formatted.
 * These blocks specify the sections, fields, and requirements for skill content output.
 *
 * Tier 1 (Locked) - Core system functionality
 */

import type { PromptBlock } from '../types';

export const knowledgeContentStructureBlock: PromptBlock = {
  id: 'knowledge_content_structure',
  name: 'Knowledge Skill Content Structure',
  description: 'Required sections and structure for knowledge-type skills (Q&A format).',
  tier: 1,
  content: `KNOWLEDGE SKILL CONTENT STRUCTURE:

Your "content" field MUST include these sections:

1. **Main Skill Body** (Opening section)
   - Comprehensive facts, specifications, and details extracted from sources
   - Inline citations [1], [2], [3] placed after facts
   - Well-organized with subsections if needed (use ### headers)
   - Include all important lists, numbers, versions, capabilities
   - Complete lists - never "X, Y, Z, and more" - list everything

2. **## Common Questions** (Required section)
   - List the most important questions this skill answers
   - Include brief answers for each
   - Can be 1-2 for narrow topics, 8-10 for broad topics
   - If source materials include Q&A sections, include them verbatim/minimally adapted
   - Format:
     **Q: What is X?**
     A: [Answer with citation if needed]

3. **## Scope Definition** (Required section)
   - "covers": What this skill currently covers (1-2 sentences)
   - "futureAdditions": Types of content to add later (specific items)
   - "notIncluded": What should explicitly NOT be in this skill
   - Example:
     covers: "Technical specifications and capabilities including models and rate limits"
     futureAdditions: ["New model releases", "Updated rate limits", "Performance benchmarks"]
     notIncluded: ["Getting started tutorials", "Pricing information"]

4. **## Sources** (Required section)
   - List each source with its citation number
   - Format: "[1] Source Label" (for URL sources use the URL)
   - Include all sources used in the skill
   - Example:
     [1] https://example.com/docs
     [2] Slack thread: Product roadmap discussion (Jan 2024)
     [3] Support Docs: API Reference`,
};

export const intelligenceContentStructureBlock: PromptBlock = {
  id: 'intelligence_content_structure',
  name: 'Intelligence Skill Content Structure',
  description: 'Required sections and structure for intelligence-type skills (narrative format, no Q&A).',
  tier: 1,
  content: `INTELLIGENCE SKILL CONTENT STRUCTURE:

Your "content" field MUST include these sections:

1. **Main Skill Body** (Opening section)
   - Narrative context and intelligence extracted from sources
   - Inline citations [1], [2], [3] placed after facts
   - Well-organized with subsections if needed (use ### headers)
   - Include all important lists, numbers, dates, details
   - Complete lists - never "X, Y, Z, and more" - list everything
   - Focus on context and relationships, not procedural how-to content

2. **## Scope Definition** (Required section)
   - "covers": What this skill currently covers (1-2 sentences)
   - "futureAdditions": Types of content to add later (specific items)
   - "notIncluded": What should explicitly NOT be in this skill
   - Example:
     covers: "Account background, contract details, and key stakeholder information"
     futureAdditions: ["Recent meetings and decisions", "Expansion opportunities"]
     notIncluded: ["Technical implementation details", "Product how-to guides"]

3. **## Sources** (Required section)
   - List each source with its citation number
   - Format: "[1] Source Label" (for URL sources use the URL)
   - Include all sources used in the skill
   - Example:
     [1] https://example.com/docs
     [2] Gong call: Q4 Business Review (Dec 2025)
     [3] CRM: Account Profile`,
};

// Legacy alias for backward compatibility
export const skillContentStructureBlock = knowledgeContentStructureBlock;

export const skillCommonQuestionsRequirementBlock: PromptBlock = {
  id: 'skill_common_questions_requirement',
  name: 'Common Questions Requirement',
  description: 'Guidelines for the Common Questions section.',
  tier: 2,
  content: `COMMON QUESTIONS SECTION:

Every skill must include a "## Common Questions" section.

PURPOSE:
- Help match skills to incoming questions
- Make skills self-documenting
- Provide quick answers for common use cases
- Enable better search and discovery

QUANTITY GUIDANCE:
Base question count on the skill's factual coverage:
- Narrow/single-feature topics (< 1500 chars): 1-2 questions
- Medium/multi-feature topics (1500-3500 chars): 3-5 questions
- Broad/comprehensive topics (> 3500 chars): 6-10 questions
- Include all genuinely important questions this skill answers

SOURCE MATERIAL PRIORITY:
If the source materials already contain a Q&A section:
- Include ALL those questions and answers
- Adapt minimally only if needed for clarity
- Don't truncate or summarize the Q&A section

FORMAT:
**Q: [Question text]**
A: [Answer text with citations if applicable]

EXAMPLES:
**Q: What formats does the API support?**
A: JSON, XML, and CSV. [1]

**Q: What's the rate limit?**
A: 1000 requests per minute for standard accounts. [2]

**Q: How do I authenticate?**
A: Use OAuth 2.0 with your API key. See the authentication guide in sources. [1]`,
};

export const skillCitationEmbeddingBlock: PromptBlock = {
  id: 'skill_citation_embedding',
  name: 'Citation Embedding in Content',
  description: 'How to embed citations in skill content sections.',
  tier: 1,
  content: `EMBEDDING CITATIONS IN CONTENT:

Skills now embed all source information directly in the content.
This makes skills self-contained and usable independently.

CITATION NUMBERS:
- Assign [1], [2], [3] to sources in the order they appear
- Each number refers to exactly one source
- Use the SAME number every time you reference that source

PLACEMENT:
- Add citations after facts from specific sources
- Place inline, not as footnotes
- Examples:
  "The API supports rate limiting of 1000 requests/minute. [1]"
  "OAuth 2.0 is required for authentication. [2]"
  "Version 3.0 was released in March 2024. [1]"

WHEN TO ADD CITATIONS:
- Specific technical details (capabilities, specifications, configurations)
- Version numbers and release dates
- Quantitative data (numbers, limits, thresholds)
- Processes and procedures described by sources
- Policy statements or compliance requirements

WHEN NOT TO ADD CITATIONS:
- General knowledge or widely accepted facts
- Your own synthesis or organizational structure
- Transitions between topics
- Section headers

SOURCES SECTION FORMAT:
At the end of your content, add this exact structure:

## Sources
[1] https://api.example.com/docs
[2] https://blog.example.com/march-update
[3] Product Roadmap Document (Jan 2024)

Each source on its own line, citation number in brackets, followed by the label.
- For URLs: use the actual URL (prefer .com domains for primary sources)
- For other sources: use document title, "Slack thread", ticket number, etc.

WHY THIS MATTERS:
- Makes content self-documenting
- Enables independent use of skill content
- Allows verification against original sources
- Creates transparent, traceable knowledge`,
};

export const skillListCompletenessBlock: PromptBlock = {
  id: 'skill_list_completeness',
  name: 'List Completeness Requirement',
  description: 'Never truncate lists - include everything from sources.',
  tier: 1,
  content: `LIST COMPLETENESS - NEVER TRUNCATE:

When a source contains a list, include ALL items.

DO NOT say:
- "including X, Y, and Z"
- "X, Y, Z, and more"
- "such as X, Y, Z"
- "[truncated list of X items]"

ALWAYS say:
- List every single item the source provides
- If the source has 50 error codes, list all 50
- If the source has 12 integrations, list all 12
- If the source has 8 compliance certifications, list all 8

WHY THIS MATTERS:
- Completeness is critical for accuracy
- Lists are often searched and referenced
- Users need to know ALL options, not just examples
- Sources that provide complete lists should be preserved as-is

EXAMPLES:
Wrong: "Supports integrations including Slack, GitHub, and Jira"
Right: "Supports integrations with: Slack, GitHub, Jira, Microsoft Teams, Google Workspace, Salesforce, HubSpot, Zendesk, and Zapier"

Wrong: "Common error codes are 401, 403, and 500"
Right: "Error codes: 400, 401, 403, 404, 409, 429, 500, 502, 503, 504, ..."`,
};

export const skillVersioningBlock: PromptBlock = {
  id: 'skill_versioning',
  name: 'Versioning and Dates',
  description: 'How to handle version numbers and dates in skills.',
  tier: 2,
  content: `VERSIONING AND DATES IN SKILLS:

INCLUDE VERSION NUMBERS:
- Always include specific version numbers from sources
- Example: "OAuth 2.0", "API v3", "Version 2.1.5"
- Never say "latest version" or "current version" - be specific
- If multiple versions are described, list all of them with dates

INCLUDE DATES:
- When sources provide release dates, include them
- Example: "Released in March 2024", "Updated July 2023"
- Use dates as context for when information was current
- Note if information might be outdated based on dates

DEPRECATION NOTICES:
- If a source mentions deprecated versions or features, preserve that
- Mark deprecated items clearly
- Example: "OAuth 1.0 (deprecated) - use OAuth 2.0 instead"`,
};

export const skillUpdateBlock: PromptBlock = {
  id: 'skill_update_structure',
  name: 'Update-Specific Structure',
  description: 'Additional structure requirements for skill updates.',
  tier: 2,
  content: `STRUCTURE FOR SKILL UPDATES:

When updating an existing skill, follow the main skill content structure PLUS:

PRESERVED CITATIONS:
- Keep existing citation numbers for existing sources
- Example: If existing skill has [1] and [2], don't change them
- Map existing source IDs to existing citation numbers
- Assign new sequential numbers to new sources ([3], [4], etc.)

SOURCES SECTION MUST INCLUDE:
- ALL existing sources (with their original citation numbers)
- ALL new sources (with new sequential citation numbers)
- If a source was removed from content, you may exclude it
- Format: "[1] Source Label", "[2] Another Source", etc.

CHANGED CONTENT TRACKING:
- You'll report what changed in a separate "changes" output
- Content structure itself doesn't need to flag changes
- The "## Sources" section should reflect the final, updated list`,
};

export const skillRefreshBlock: PromptBlock = {
  id: 'skill_refresh_structure',
  name: 'Refresh-Specific Structure',
  description: 'Additional structure requirements for format refresh operations.',
  tier: 2,
  content: `STRUCTURE FOR FORMAT REFRESH:

When doing a format refresh (reformatting to current standards):

ALWAYS REGENERATE:
- Restructure the entire skill content through current standards
- This is format improvement, not content validation

PRESERVE ALL SOURCES:
- Use ALL incorporated sources in the regenerated content
- Citations should reflect the final version after regeneration
- If sources were previously embedded, ensure they remain embedded
- The "## Sources" section should list all incorporated sources

CITATION RE-NUMBERING:
- Re-number citations for consistency: [1], [2], [3], etc.
- Order them by first appearance in content
- Ensure no gaps or skipped numbers
- The "## Sources" section order should match content order

STRUCTURAL IMPROVEMENTS:
- Add/improve section headers for clarity
- Restructure content for better flow and readability
- Ensure all required sections are present and well-formatted
- Apply consistent formatting to subsections and lists`,
};

export const skillOutputBlocks: PromptBlock[] = [
  knowledgeContentStructureBlock,
  intelligenceContentStructureBlock,
  skillCommonQuestionsRequirementBlock,
  skillCitationEmbeddingBlock,
  skillListCompletenessBlock,
  skillVersioningBlock,
  skillUpdateBlock,
  skillRefreshBlock,
];
