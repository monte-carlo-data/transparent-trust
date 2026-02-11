/**
 * AWS S3 Storage Service
 *
 * Provides file upload, download, and deletion functionality for AWS S3.
 * Replaces database BLOB storage for documents and customer files.
 *
 * Features:
 * - Server-side encryption (AES-256)
 * - Presigned URLs for secure downloads
 * - Automatic content-type detection
 * - Structured key naming convention
 *
 * @module lib/s3
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

/**
 * S3 client configuration
 * Uses IAM roles in ECS, falls back to env vars for local development
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  // credentials: Auto-detected from IAM role in ECS or env vars locally
});

const BUCKET_NAME = process.env.S3_DOCUMENTS_BUCKET || "transparent-trust-uploads-development";

/**
 * Upload a file to S3 with server-side encryption
 *
 * @param key - S3 object key (path within bucket)
 * @param buffer - File content as Buffer
 * @param contentType - MIME type of the file
 * @returns S3 URI (s3://bucket/key)
 *
 * @example
 * const s3Uri = await uploadToS3(
 *   "documents/pdf/doc-123_contract.pdf",
 *   fileBuffer,
 *   "application/pdf"
 * );
 */
export async function uploadToS3(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ServerSideEncryption: "AES256", // Encrypt at rest
        Metadata: {
          uploadedAt: new Date().toISOString(),
        },
      })
    );

    logger.info("File uploaded to S3", { key, bucket: BUCKET_NAME, size: buffer.length });
    return `s3://${BUCKET_NAME}/${key}`;
  } catch (error) {
    logger.error("Failed to upload to S3", error, { key, bucket: BUCKET_NAME });
    throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Download a file from S3
 *
 * @param key - S3 object key
 * @returns File content as Buffer
 *
 * @example
 * const fileBuffer = await getFromS3("documents/pdf/doc-123_contract.pdf");
 */
export async function getFromS3(key: string): Promise<Buffer> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error("S3 object has no body");
    }

    // Convert ReadableStream to Buffer
    const stream = response.Body as ReadableStream;
    const chunks: Uint8Array[] = [];
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    logger.info("File retrieved from S3", { key, bucket: BUCKET_NAME, size: buffer.length });
    return buffer;
  } catch (error) {
    logger.error("Failed to get from S3", error, { key, bucket: BUCKET_NAME });
    throw new Error(`S3 retrieval failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete a file from S3
 *
 * @param key - S3 object key
 *
 * @example
 * await deleteFromS3("documents/pdf/doc-123_contract.pdf");
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    logger.info("File deleted from S3", { key, bucket: BUCKET_NAME });
  } catch (error) {
    logger.error("Failed to delete from S3", error, { key, bucket: BUCKET_NAME });
    // Don't throw - deletion failures shouldn't block operations
    // The file will remain in S3 but can be cleaned up later
  }
}

/**
 * Generate a presigned URL for secure file download
 *
 * Presigned URLs allow temporary access to private S3 objects without
 * making them publicly accessible. URLs expire after the specified time.
 *
 * @param key - S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 *
 * @example
 * const downloadUrl = await getSignedDownloadUrl("documents/pdf/doc-123.pdf", 3600);
 * // URL valid for 1 hour
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    logger.info("Generated presigned URL", { key, expiresIn });
    return url;
  } catch (error) {
    logger.error("Failed to generate presigned URL", error, { key });
    throw new Error(`Presigned URL generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate a structured S3 key for a document
 *
 * Key format: documents/{fileType}/{id}_{timestamp}_{sanitizedFilename}
 *
 * Benefits:
 * - Organized by file type for easier management
 * - Unique keys prevent collisions
 * - Timestamp enables chronological sorting
 * - Original filename preserved for debugging
 *
 * @param fileType - File extension (pdf, docx, txt, etc.)
 * @param filename - Original filename
 * @param id - Document ID from database
 * @returns S3 key
 *
 * @example
 * generateS3Key("pdf", "Q4 Contract.pdf", "doc-123")
 * // Returns: "documents/pdf/doc-123_1703721600000_Q4_Contract.pdf"
 */
export function generateS3Key(fileType: string, filename: string, id: string): string {
  const timestamp = Date.now();
  // Sanitize filename: replace non-alphanumeric chars with underscore
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `documents/${fileType}/${id}_${timestamp}_${sanitized}`;
}

/**
 * Check if S3 is configured and accessible
 *
 * @returns true if S3 credentials and bucket are configured
 */
export function isS3Configured(): boolean {
  const hasRegion = !!process.env.AWS_REGION;
  const hasBucket = !!process.env.S3_DOCUMENTS_BUCKET;

  // In ECS, credentials come from IAM role (no env vars needed)
  // In local dev, credentials come from AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
  const hasCredentials =
    !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
    !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI; // ECS IAM role indicator

  return hasRegion && hasBucket && hasCredentials;
}

/**
 * Get MIME type for common file extensions
 *
 * @param fileType - File extension
 * @returns MIME type
 */
export function getMimeType(fileType: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    json: "application/json",
    md: "text/markdown",
  };

  return mimeTypes[fileType.toLowerCase()] || "application/octet-stream";
}
