/**
 * Document Discovery Adapter
 *
 * Handles uploaded documents (PDF, DOCX, etc.).
 * Extracts text content for staging.
 */

import { BaseDiscoveryAdapter } from './base-adapter';
import { extractTextContent } from '@/lib/documentExtractor';
import type { SupportedFileType } from '@/lib/documentExtractor';
import type {
  DiscoveryOptions,
  DiscoveredSource,
  DocumentStagedSource,
  DocumentSourceMetadata,
} from '@/types/v2';

// For production, you'd use libraries like:
// - pdf-parse for PDFs
// - mammoth for DOCX
// - AWS Textract for OCR

export class DocumentDiscoveryAdapter extends BaseDiscoveryAdapter<DocumentStagedSource> {
  readonly sourceType = 'document' as const;
  readonly displayName = 'Uploaded Documents';

  /**
   * Document adapter doesn't auto-discover - documents are uploaded manually.
   */
  async discover(_options: DiscoveryOptions): Promise<DiscoveredSource<DocumentStagedSource>[]> {
    void _options; // Unused but required by interface
    // Documents are staged via direct upload, not discovery
    return [];
  }

  /**
   * Process and stage an uploaded document.
   */
  async processAndStage(
    file: {
      name: string;
      type: string;
      size: number;
      buffer: Buffer;
    },
    options: DiscoveryOptions & {
      s3Key?: string;
      bucket?: string;
      uploadedBy?: string;
    }
  ): Promise<DocumentStagedSource> {
    const { name, type, size, buffer } = file;

    // Track extraction timing
    const extractionStart = Date.now();

    // Extract text content based on file type
    const textContent = await this.extractText(buffer, type);

    const extractionDuration = Date.now() - extractionStart;

    // Generate a unique ID for this document
    const externalId = `doc_${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const metadata: DocumentSourceMetadata = {
      fileName: name,
      fileType: this.getFileExtension(name),
      mimeType: type,
      fileSize: size,
      s3Key: options.s3Key,
      bucket: options.bucket,
      uploadedBy: options.uploadedBy,
      uploadedAt: new Date().toISOString(),
      pageCount: await this.getPageCount(buffer, type),
      textPreview: textContent ? this.generatePreview(textContent, 500) : undefined,
      ocrProcessed: false, // Would be true if OCR was used

      // V2: Extraction metadata
      extractionMethod: this.getExtractionMethod(type),
      extractionDuration,
      textLength: textContent?.length,
    };

    // Log successful extraction
    if (textContent) {
      console.log(`[DocumentAdapter] Extracted ${textContent.length} chars from ${name} in ${extractionDuration}ms`);
    }

    const title = this.generateTitle(name);

    return this.stageSingleSource(
      {
        externalId,
        title,
        content: textContent,
        contentPreview: textContent ? this.generatePreview(textContent) : undefined,
        metadata,
      },
      options
    );
  }

  /**
   * Extract text from document based on file type.
   * Uses pdf-parse for PDFs, mammoth for DOCX, exceljs for XLSX, etc.
   */
  private async extractText(buffer: Buffer, mimeType: string): Promise<string | undefined> {
    try {
      // Detect file type from MIME or fail gracefully
      const fileType = this.mapMimeToFileType(mimeType);
      if (!fileType) {
        console.warn(`[DocumentAdapter] Unsupported MIME type for extraction: ${mimeType}`);
        return undefined;
      }

      // Use existing extraction utility
      const text = await extractTextContent(buffer, fileType, {
        sanitize: true,
      });

      return text;
    } catch (error) {
      console.error(`[DocumentAdapter] Extraction failed for ${mimeType}:`, error);
      // Return undefined for graceful degradation
      // User will see "no content" error in skill generation
      return undefined;
    }
  }

  /**
   * Map MIME type to documentExtractor file type.
   */
  private mapMimeToFileType(mimeType: string): SupportedFileType | null {
    const mapping: Record<string, SupportedFileType> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/plain': 'txt',
      'text/markdown': 'txt',
      'text/md': 'txt',
      'text/csv': 'txt',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xlsx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    return mapping[mimeType] || null;
  }

  /**
   * Get extraction method name for metadata.
   */
  private getExtractionMethod(mimeType: string): DocumentSourceMetadata['extractionMethod'] {
    if (mimeType === 'application/pdf') return 'pdf-parse';
    if (mimeType.includes('wordprocessingml')) return 'mammoth';
    if (mimeType.includes('spreadsheetml')) return 'exceljs';
    if (mimeType.includes('presentationml')) return 'pptx-parser';
    if (mimeType.startsWith('text/')) return 'direct';
    return 'direct';
  }

  /**
   * Get page count for supported document types.
   */
  private async getPageCount(buffer: Buffer, mimeType: string): Promise<number | undefined> {
    // In production, use pdf-parse or similar to get actual page count
    if (mimeType === 'application/pdf') {
      // Placeholder - would use pdf-parse
      return undefined;
    }
    return undefined;
  }

  /**
   * Extract file extension from filename.
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * Generate a clean title from filename.
   */
  private generateTitle(filename: string): string {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    // Replace underscores/dashes with spaces
    const cleaned = nameWithoutExt.replace(/[_-]/g, ' ');
    // Title case
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Get supported file types.
   */
  getSupportedTypes(): string[] {
    return [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
  }

  /**
   * Check if a file type is supported.
   */
  isSupported(mimeType: string): boolean {
    return this.getSupportedTypes().includes(mimeType);
  }
}

// Export singleton instance
export const documentAdapter = new DocumentDiscoveryAdapter();
