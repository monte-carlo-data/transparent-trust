/**
 * V2 PDF Extraction Blocks
 *
 * Prompts for PDF text extraction functionality.
 * These blocks can be edited in Admin > Prompts.
 */

import type { PromptBlock } from '../types';

export const pdfExtractionInstructionsBlock: PromptBlock = {
  id: 'pdf_extraction_instructions',
  name: 'PDF Extraction Instructions',
  description: 'Instructions for extracting text from PDF documents.',
  tier: 2,
  content: `Extract ALL text content from this PDF document.

IMPORTANT RULES:
1. Extract the complete text content, preserving the document structure
2. Include headers, paragraphs, bullet points, tables, and any other text
3. Preserve the logical reading order
4. For tables, format them clearly with columns separated by | characters
5. Do NOT summarize or interpret - extract the actual text verbatim
6. Do NOT add any commentary or explanations
7. If there are multiple pages, extract all pages

Return ONLY the extracted text content, nothing else.`,
};

export const pdfExtractionBlocks: PromptBlock[] = [
  pdfExtractionInstructionsBlock,
];
