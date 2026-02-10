/**
 * File Type Validation using Magic Bytes
 *
 * Validates actual file types instead of relying on client-provided MIME types.
 * Prevents file type spoofing attacks (e.g., executable disguised as PDF).
 *
 * Supports: PDF, DOCX, XLSX, PPTX, DOC, XLS, TXT, CSV, MD
 */

export interface FileValidationResult {
  isValid: boolean;
  detectedType: string | null;
  declaredMimeType: string;
  mismatch: boolean;
  error?: string;
}

/**
 * Validate file type using magic bytes (file signature).
 *
 * @param buffer - File buffer
 * @param declaredMimeType - MIME type from client (untrusted)
 * @param filename - Original filename (for logging only)
 * @returns Validation result with detected type and mismatch flag
 */
export function validateFileType(
  buffer: Buffer,
  declaredMimeType: string
): FileValidationResult {
  if (buffer.length === 0) {
    return {
      isValid: false,
      detectedType: null,
      declaredMimeType,
      mismatch: true,
      error: 'File is empty',
    };
  }

  // Check first 12 bytes for file signatures
  const header = buffer.slice(0, 12);

  // Detect actual type from magic bytes
  const detectedType = detectMagicBytes(header, buffer);

  // Map declared MIME to expected signature
  const expectedType = mapMimeToType(declaredMimeType);

  // Check for mismatch
  const mismatch =
    detectedType !== null &&
    expectedType !== null &&
    detectedType !== expectedType;

  return {
    isValid: !mismatch && detectedType !== null,
    detectedType,
    declaredMimeType,
    mismatch,
    error: mismatch
      ? `File appears to be ${detectedType} but declared as ${expectedType}`
      : detectedType === null
        ? 'Unable to identify file type'
        : undefined,
  };
}

/**
 * Detect file type from magic bytes (file signature).
 *
 * @param header - First 12 bytes of file
 * @param fullBuffer - Full file buffer (for more complex detection)
 * @returns Detected file type or null if unknown
 */
function detectMagicBytes(header: Buffer, fullBuffer: Buffer): string | null {
  // Need at least 4 bytes for most signature checks
  if (header.length < 4) {
    // Fall back to text detection for very small files
    if (isTextFile(fullBuffer)) {
      return 'text';
    }
    return null;
  }

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (header[0] === 0x25 && header[1] === 0x50 &&
      header[2] === 0x44 && header[3] === 0x46) {
    return 'pdf';
  }

  // DOCX/XLSX/PPTX: ZIP signature (0x50 0x4B 0x03 0x04)
  // Note: All modern Office formats (DOCX, XLSX, PPTX) are ZIP archives.
  // We detect them as generic 'office' type since they share the same signature.
  if (header[0] === 0x50 && header[1] === 0x4b &&
      header[2] === 0x03 && header[3] === 0x04) {
    return detectOfficeFormat() || 'office';
  }

  // DOC/XLS/PPT (legacy): OLE2 Compound Document signature (0xD0 0xCF 0x11 0xE0)
  // Note: Legacy Office formats share the same OLE2 signature.
  // We detect them as 'ole' type since we can't distinguish DOC from XLS from PPT.
  if (header[0] === 0xd0 && header[1] === 0xcf &&
      header[2] === 0x11 && header[3] === 0xe0) {
    return 'ole';
  }

  // TXT/CSV/MD: Check if valid text (no binary markers)
  if (isTextFile(fullBuffer)) {
    return 'text';
  }

  return null;
}

/**
 * Detect specific Office format (DOCX vs XLSX vs PPTX).
 * All have ZIP signature, but contain different [Content_Types].xml entries.
 *
 * @param buffer - Full file buffer
 * @returns Office format name or null if undetermined
 */
function detectOfficeFormat(): string | null {
  // For a complete implementation, we'd need to extract and parse [Content_Types].xml
  // For now, return null to fall back to generic 'office' type
  // This is sufficient for security validation - we just need to know it's a ZIP archive
  // and not an executable masquerading as Office

  return null;
}

/**
 * Check if buffer appears to be a text file (no binary markers).
 *
 * @param buffer - File buffer
 * @returns true if file appears to be valid text
 */
function isTextFile(buffer: Buffer): boolean {
  // Need at least some content
  if (buffer.length === 0) return false;

  // Sample first 512 bytes for text detection
  const sample = buffer.slice(0, Math.min(512, buffer.length));

  // Check for null bytes (binary indicator)
  if (sample.includes(0x00)) return false;

  // Check for very high proportion of non-printable characters
  let nonPrintableCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    // Allow common whitespace and control chars (tab, newline, carriage return)
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      nonPrintableCount++;
    }
  }

  // If more than 30% non-printable, likely binary
  if (nonPrintableCount / sample.length > 0.3) return false;

  // Passed all binary checks - treat as text
  // Note: Buffer.toString('utf-8') doesn't throw in Node.js (it replaces invalid bytes),
  // so we rely on the binary checks above for validation
  return true;
}

/**
 * Map MIME type to expected file signature type.
 *
 * @param mimeType - MIME type from client
 * @returns Expected file type or null if unknown
 */
function mapMimeToType(mimeType: string): string | null {
  const mapping: Record<string, string> = {
    // PDF
    'application/pdf': 'pdf',
    // Modern Office (ZIP-based)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'office',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'office',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'office',
    // Legacy Office (OLE2-based)
    'application/msword': 'ole',
    'application/vnd.ms-excel': 'ole',
    // Text formats
    'text/plain': 'text',
    'text/markdown': 'text',
    'text/md': 'text',
    'text/csv': 'text',
  };

  return mapping[mimeType] || null;
}
