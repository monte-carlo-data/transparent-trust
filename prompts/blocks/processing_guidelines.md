---
id: processing_guidelines
name: Processing Guidelines
description: Specific rules for how to process and handle the input.
tier: 2
created: '2025-12-20T06:09:22.488Z'
updated: '2025-12-20T06:09:22.488Z'
updatedBy: system@migration.local
---
Process the input carefully and thoroughly.

---variant:skill_organize---

Consolidation Principles:
- Prefer UPDATING existing skills over creating new ones
- Merge related topics into comprehensive skills
- Each skill should cover a coherent topic area
- Avoid creating skills for trivial or one-off information

Content Guidelines:
- Extract specific facts, not vague summaries
- Include relevant details like versions, dates, certifications
- Use professional, consistent formatting
- Remove customer-specific context - make skills reusable

---variant:customer_profile---

## Content Structure
Build a comprehensive profile in the 'content' field using markdown sections:

### Overview Section
Write 2-4 paragraphs covering:
- What the company does (core business)
- Target market and customer base
- Market position and competitive landscape
- Brief history if relevant (founding, growth milestones)
- Geographic presence and scale
- Recent news, funding, or strategic initiatives

Write in clear, professional prose. Be factual.

### Products & Services Section
- Their main offerings and solutions
- Platform/product names if known
- Target use cases

### Key Facts Section
Use bullet points for structured data:
- Founded: [year]
- Headquarters: [location]
- Employees: [count or range]
- Revenue: [if available]
- Certifications: [if relevant]
Only include facts from source material. Use ranges when exact numbers aren't available.

### Challenges & Needs Section
Identify from sources:
- Industry-specific challenges (regulatory, competitive, technical)
- Stated priorities from press releases, earnings calls, or job postings
- Technology transformation initiatives
- Security or compliance requirements implied by their industry

Mark inferences clearly: 'Based on their industry, they likely need...'

## Considerations Array
Include special notes that would be helpful when working with this customer:
- Regulated industry flags
- Recent major changes (M&A, leadership, strategy)
- Known relationship context
- Important sensitivities

## EXCLUDE
- Personal information about individuals
- Speculation not supported by sources
- Marketing superlatives without substance
- Pricing information
- Confidential or non-public information

---variant:prompt_optimize---

Analysis Categories:
- REMOVE: Redundant or unnecessary content
- SIMPLIFY: Overly complex instructions that can be streamlined
- MERGE: Duplicate sections that should be combined
- RESTRUCTURE: Poorly organized content that needs reordering

Optimization Rules:
- Preserve all essential instructions
- Maintain the original intent and behavior
- Keep critical safety and quality checks
- Estimate token savings accurately
