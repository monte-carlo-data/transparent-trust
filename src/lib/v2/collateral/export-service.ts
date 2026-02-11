/**
 * Export Service
 *
 * Handles exporting generated collateral to various formats:
 * - Google Slides (using existing googleSlides.ts integration)
 * - Text/Markdown (direct return)
 * - Future: Word, PDF
 */

import { fillPresentation, extractPlaceholders } from '@/lib/googleSlides';
import type { PlaceholderReplacement } from '@/lib/googleSlides';

export type ExportFormat = 'text' | 'google-slides' | 'word' | 'pdf';

export interface ExportResult {
  format: ExportFormat;
  /** For text format: the generated content */
  content?: string;
  /** For Google Slides: the presentation ID */
  presentationId?: string;
  /** For Google Slides: the web view link */
  webViewLink?: string;
  /** Any errors or warnings */
  errors?: string[];
}

export interface GoogleSlidesExportInput {
  userId: string;
  templatePresentationId: string;
  placeholders: Record<string, string>;
  copyTitle?: string;
}

/**
 * Export to Google Slides by filling placeholders in a template.
 * Creates a copy of the template and fills in the placeholder values.
 */
export async function exportToGoogleSlides(
  input: GoogleSlidesExportInput
): Promise<ExportResult> {
  const { userId, templatePresentationId, placeholders, copyTitle } = input;

  // Convert placeholders object to replacement array
  const replacements: PlaceholderReplacement[] = Object.entries(placeholders).map(
    ([placeholder, value]) => ({
      placeholder, // Will be wrapped in {{ }} by fillPresentation
      value,
    })
  );

  const result = await fillPresentation(userId, templatePresentationId, replacements, {
    copyFirst: true,
    copyTitle: copyTitle || `Generated - ${new Date().toISOString().split('T')[0]}`,
  });

  return {
    format: 'google-slides',
    presentationId: result.presentationId,
    webViewLink: result.webViewLink,
  };
}

/**
 * Get the placeholders from a Google Slides template.
 * Useful for showing what placeholders need to be filled.
 */
export async function getGoogleSlidesPlaceholders(
  userId: string,
  presentationId: string
): Promise<string[]> {
  return extractPlaceholders(userId, presentationId);
}

/**
 * Export to text format (just returns the content).
 */
export function exportToText(content: string): ExportResult {
  return {
    format: 'text',
    content,
  };
}
