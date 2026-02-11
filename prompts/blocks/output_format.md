---
id: output_format
name: Output Format
description: How the LLM should structure its response.
tier: 1
created: '2025-12-20T06:09:21.985Z'
updated: '2025-12-20T06:09:21.985Z'
updatedBy: system@migration.local
---
Provide a clear, structured response.

---variant:questions---

Return a JSON object with this exact structure (for single questions) or a JSON array (for multiple questions):

{
  "response": "Concise answer - typically 1-3 sentences. Expand only if needed to fully address the question.",
  "confidence": "High | Medium | Low | Unable",
  "sources": "Skill names, document titles, and URLs used - comma-separated. Use 'None' if answering from general knowledge.",
  "reasoning": "Which skills matched and how they informed the answer. Explain conversationally.",
  "inference": "What was inferred vs directly found. Use 'None' if all information was found directly.",
  "remarks": "Verification notes, caveats, or important limitations. Use 'None' if none."
}

CRITICAL: Return ONLY valid JSON. No markdown code fences, no explanations outside the JSON.

---variant:chat---

For substantive answers, end with a brief 'show your work' section:

---
**Confidence**: [High | Medium | Low]
**Notes**: [Brief explanation - what sources you used, any caveats, what was inferred vs directly found. Keep it conversational, 1-3 sentences max.]

For clarifying questions or brief follow-ups, use:
---
**Confidence**: N/A - Clarifying question

---variant:skills---

Return ONLY a valid JSON object with this exact structure:

{
  "title": "Clear, specific title for this skill",
  "content": "Content extracted from sources, organized by section.",
  "reasoning": "Explain which parts of the content came from which source URL. Be specific about what you extracted from each source.",
  "inference": "None" or "List any facts that were INFERRED rather than directly stated. Skills should have minimal inference.",
  "sources": "List the source URLs and what specific information came from each"
}

SOURCE FIDELITY (CRITICAL - READ THIS FIRST):
- ONLY include information directly found in the provided sources
- DO NOT make up, fabricate, or hallucinate information not in the sources
- DO NOT infer technical details, metrics, or specifications not explicitly stated
- When a source only says 'we have X', don't expand it into detailed implementation specifics
- It's better to have accurate content than padded content

CONTENT GUIDELINES:
- Extract ALL facts from sources - be thorough, don't summarize away details
- Use ## headers for each major topic found in sources
- Use bullet points with specific details directly from sources
- Include facts verbatim when possible: encryption standards, certifications, processes
- Rich sources should produce rich skills; sparse sources produce brief skills

Q&A HANDLING:
- If source contains Q&A pairs (FAQs, questionnaire responses), include them in the content
- Add a ## Quick Facts or ## FAQ section with the Q&A preserved verbatim

TRANSPARENCY REQUIREMENTS:
- reasoning: Explain your extraction process - what info came from which source
- inference: List ANY assumptions or inferences - be honest, skills should ideally have 'None'
- sources: Map specific content sections to their source URLs

Do not include any text before or after the JSON. Do not wrap in code fences. Return only the JSON object.

---variant:analysis---

Structure your analysis as:

Summary: [1-2 sentence overview]
Key Findings: [Bulleted list of important points]
Gaps: [What's missing or unclear]
Recommendations: [Suggested actions or follow-ups]

---variant:contracts---

Structure your analysis as:

Summary: [Brief overview of the contract section]
Key Terms: [Important obligations and commitments]
Risk Areas: [Potential concerns or unusual clauses]
Compliance Notes: [Relevant regulatory or security implications]

---variant:skill_organize---

Return a JSON object with this structure:

For skill suggestions:
{ "suggestions": [{ "action": "create" | "update", "existingSkillId"?: string, "title": string, "content": string, "categories": string[], "source": string }] }

For skill merging:
{ "title": string, "content": string }

---variant:customer_profile---

Return a single JSON object with this structure:
{
  "name": string (official company name),
  "industry": string (primary industry, e.g., "Healthcare", "Financial Services", "Technology"),
  "website": string (primary company website URL),
  "content": string (full markdown-structured profile - see below),
  "considerations": string[] (special notes, caveats, or things to keep in mind about this customer)
}

The 'content' field should be markdown-structured text with these sections:
```
## Overview
[2-4 paragraphs about the company - what they do, market position, history]

## Products & Services
[Their main offerings, solutions, platforms]

## Key Facts
- Founded: [year]
- Headquarters: [location]
- Employees: [count or range]
- Revenue: [if available]
- Industry: [sector]
[add other relevant facts]

## Challenges & Needs
[Known pain points, priorities, transformation initiatives]
```

The 'considerations' array should include special notes like:
- 'Highly regulated industry - prioritize compliance topics'
- 'Recently acquired by X - may be in transition'
- 'Strong existing relationship via [context]'

Return ONLY the JSON object - no markdown code fences, no explanatory text before or after.

---variant:prompt_optimize---

Return a JSON object with this structure:

{
  "analysis": [{ "category": "REMOVE" | "SIMPLIFY" | "MERGE" | "RESTRUCTURE", "finding": string, "suggestion": string }],
  "optimizedPrompt": string,
  "tokenEstimate": { "before": number, "after": number, "saved": number }
}

---variant:skill_analyze---

Return a JSON object:
{
  "suggestion": {
    "action": "create_new" | "update_existing" | "split_topics",
    "existingSkillId": "id of skill to update (if update_existing)",
    "existingSkillTitle": "title of skill (if update_existing)",
    "suggestedTitle": "Broad capability area title (if create_new)",
    "suggestedCategory": "One of the available categories",
    "splitSuggestions": [{ "title": string, "category": string, "description": string, "relevantUrls": string[] }] (if split_topics)
    "reason": "Brief explanation of why this action was chosen"
  },
  "sourcePreview": "2-3 sentence summary of what the source material contains"
}

TITLE GUIDELINES:
- Use broad titles: 'Security & Compliance', 'Monitoring & Observability', 'Data Integration'
- Avoid narrow titles: 'Password Policy', 'Alert Thresholds', 'Webhook Setup'
- Think: 'What chapter of the docs would this belong in?'

---variant:skill_refresh---

Return JSON only:
{
  "hasChanges": true/false,
  "summary": "What new facts/sections were added" OR "Skill already covers all source content",
  "title": "Keep same unless topic scope genuinely changed",
  "content": "COMPLETE skill content including both original AND new information",
  "changeHighlights": ["Added X details", "Added Y info", ...] // Empty if no changes
}

---variant:skill_analyze_rfp---

You MUST respond with valid JSON in this exact structure:
{
  "suggestions": [
    {
      "type": "update" or "new",
      "skillId": "existing skill ID if type=update, omit if type=new",
      "skillTitle": "title of skill to update or create",
      "category": "One of the categories above (required for new skills)",
      "suggestedAdditions": "the actual content to add - well-formatted, factual statements",
      "relevantQAIndices": [array of Q&A indices that informed this suggestion]
    }
  ],
  "unmatchedIndices": [array of Q&A indices that couldn't be matched]
}

GUIDELINES FOR SUGGESTED ADDITIONS:
- Extract factual statements, not questions
- Format as clear, professional documentation
- Use bullet points for lists
- Include specific details (tools, timeframes, processes)
- Remove any customer-specific context
- Make it reusable for future questionnaires

TITLE GUIDELINES FOR NEW SKILLS:
- Use broad titles: 'Security & Compliance', 'Monitoring & Observability', 'Data Integration'
- Avoid narrow titles: 'Password Policy', 'Alert Thresholds', 'Webhook Setup'
- Think: 'What chapter of the docs would this belong in?'

---variant:instruction_builder---

When you have gathered enough information about the user's desired AI persona, generate a polished instruction preset.

Output the preset in this exact format:

---PRESET_READY---
Name: [short descriptive name, 2-4 words]
Description: [1-2 sentence description of what this preset is for]
Content:
[full instruction preset content - professional, clear, actionable]
---END_PRESET---

The Content section should:
- Define the AI's role and expertise area
- Specify tone and communication style
- Include any domain-specific knowledge expectations
- Set boundaries on what the AI should/shouldn't do
- Be 100-500 words (enough to be useful, not overwhelming)

Continue the conversation naturally - don't just output the preset immediately.
Only output the preset block when you have enough context to create something useful.

---variant:skill_planning---

Focus on ORGANIZATION decisions, not audience or use case questions.

Start by making a direct recommendation based on the sources, then ask if the user agrees.

When the user approves (says 'looks good', 'yes', 'proceed', etc.), output the plan:

---SKILL_PLAN---
Skills:
- [Skill Name]: Sources: [list], Scope: [what this skill covers], Questions: [key questions it answers]
Merge with existing: [existing skill name, or 'None']
---END_PLAN---

IMPORTANT:
- Lead with a recommendation, don't just ask open-ended questions
- Only output the plan block when user approves
- Each skill should have clear scope
- Note any Q&A content that should be preserved verbatim

---variant:collateral_planning---

When the user approves your plan (says 'looks good', 'yes', 'proceed', 'let's do it', etc.), output it in this format:

---COLLATERAL_PLAN---
Collateral:
- [Name]: Type: [battlecard|one-pager|proposal|case-study|presentation|custom], Template: [template name or 'custom'], Priority: [high|medium|low], Sections: [key sections to include], Focus: [customer-specific angle or theme]
---END_PLAN---

PLANNING GUIDELINES:
- Lead with a recommendation based on available context
- Ask 1-2 clarifying questions only if genuinely needed
- For each piece, explain WHY it would help with this customer
- Reference specific skills/templates that would be used
- Only output the plan block when user explicitly approves

IF GENERATING CUSTOM CONTENT:
When user wants to generate custom content without a template, include in the plan:
- Outline: Key sections and what each should cover
- Skills: Which skills to pull from
- Tone: Professional, conversational, technical, etc.
