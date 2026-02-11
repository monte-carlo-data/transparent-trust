/**
 * V2 Library-Specific Guideline Blocks
 *
 * These blocks contain library-specific guidelines for skill creation and operations.
 * They are conditionally included in skill building compositions based on the libraryId.
 *
 * These blocks can be edited in Admin > Prompts and changes apply immediately to all
 * skill operations using that library.
 */

import type { PromptBlock } from '../types';

export const libraryGuidelinesKnowledgeBlock: PromptBlock = {
  id: 'library_guidelines_knowledge',
  name: 'Knowledge Library Guidelines',
  description: 'Library-specific guidelines for Knowledge skills (product capabilities, features, technical details)',
  tier: 2,
  content: `LIBRARY: General Knowledge

KNOWLEDGE LIBRARY SPECIFICS:
- Focus on product capabilities, features, and technical details
- Include version numbers and release information when available
- Document integrations and API details
- Include practical examples and use cases

SCOPE CLARITY FOR SECURITY/COMPLIANCE CONTENT:
- If content describes INTERNAL CONTROLS (how the company operates), make this clear with headers like '## Internal Security Controls' or '## Internal Processes'
- If content describes PRODUCT FEATURES (what customers can use), make this clear with headers like '## Product Security Features' or '## Customer-Facing Capabilities'
- This prevents confusion when answering 'Does your application encrypt data?' vs 'How do you handle data internally?'

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New product releases or feature announcements
- Updated API versions or endpoints
- New integration capabilities
- Additional compliance certifications or security updates
- Performance benchmarks or technical specifications`,
};

export const libraryGuidelinesITBlock: PromptBlock = {
  id: 'library_guidelines_it',
  name: 'IT Library Guidelines',
  description: 'Library-specific guidelines for IT support skills (troubleshooting, error codes, resolution steps)',
  tier: 2,
  content: `LIBRARY: IT Support

IT LIBRARY SPECIFICS:
- Include application/system names explicitly
- Capture error codes, symptoms, and diagnostic steps
- Document resolution steps in clear, actionable sequence
- Note which department or team owns this knowledge
- Reference Zendesk ticket patterns and common issues
- Include escalation paths when relevant
- Focus on troubleshooting workflows

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New error codes or system behaviors not yet documented
- Additional troubleshooting steps or diagnostic procedures
- Updated escalation contacts or team ownership changes
- New platforms, versions, or system configurations
- Workarounds or temporary solutions that may become permanent`,
};

export const libraryGuidelinesGTMBlock: PromptBlock = {
  id: 'library_guidelines_gtm',
  name: 'GTM Library Guidelines',
  description: 'Library-specific guidelines for GTM skills (sales, positioning, objection handling)',
  tier: 2,
  content: `LIBRARY: Go-to-Market

GTM LIBRARY SPECIFICS:
- Note industry vertical relevance (Financial Services, Healthcare, etc.)
- Capture deal stage applicability (Discovery, Evaluation, Negotiation)
- Document competitor mentions and positioning strategies
- Include objection handling patterns with suggested responses
- Capture win/loss insights and proof points
- Include relevant case study references
- Focus on patterns that apply across multiple customers

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New competitor responses or positioning updates
- Additional objection handling strategies or counterarguments
- Fresh case studies or proof points for this vertical
- Emerging market trends or customer pain points
- Updated customer testimonials or win patterns`,
};

export const libraryGuidelinesCustomersBlock: PromptBlock = {
  id: 'library_guidelines_customers',
  name: 'Customer Library Guidelines',
  description: 'Library-specific guidelines for customer-scoped skills',
  tier: 2,
  content: `LIBRARY: Customer Profiles

CUSTOMER LIBRARY SPECIFICS:
- This is a customer-specific skill/profile scoped to a single customer
- Include customer name and context naturally in content
- Capture customer-specific pain points, use cases, and requirements
- Note which products/features this customer uses
- Reference relevant interactions (Gong calls, support tickets, etc.)
- Can build on org-level knowledge but adds customer-specific lens
- Keep separate from org-wide GTM skills (those are for patterns across customers)

FUTURE ADDITIONS GUIDANCE:
When defining futureAdditions, think about:
- New use cases discovered in customer interactions
- Updated product feature adoptions or roadmap requests
- Additional customer pain points or strategic initiatives
- New contacts or organizational changes at the customer
- Emerging opportunities or expansion vectors`,
};

// Export all library guideline blocks
export const libraryGuidelineBlocks: PromptBlock[] = [
  libraryGuidelinesKnowledgeBlock,
  libraryGuidelinesITBlock,
  libraryGuidelinesGTMBlock,
  libraryGuidelinesCustomersBlock,
];

/**
 * Map libraryId to guideline block ID
 * Returns null if the library doesn't have a guideline block
 */
export function getLibraryGuidelineBlockId(libraryId: string): string | null {
  const mapping: Record<string, string> = {
    knowledge: 'library_guidelines_knowledge',
    it: 'library_guidelines_it',
    gtm: 'library_guidelines_gtm',
    customers: 'library_guidelines_customers',
  };
  return mapping[libraryId] || null;
}
