/**
 * POST /api/v2/sources/upload-document
 * Upload and stage a document file
 *
 * Accepts FormData with:
 * - file: File to upload
 * - libraryId: Target library
 *
 * Returns: Staged source with metadata and S3 key
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { stageSource } from '@/lib/v2/sources';
import { canManageLibrary } from '@/lib/v2/teams';
import { uploadToS3, generateS3Key } from '@/lib/s3';
import { documentAdapter } from '@/lib/v2/sources/adapters/document-adapter';
import { validateFileType } from '@/lib/fileValidation';
import type { LibraryId } from '@/types/v2';
import { LIBRARY_IDS } from '@/types/v2';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const libraryId = formData.get('libraryId') as LibraryId | null;
    const customerId = formData.get('customerId') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!libraryId) {
      return NextResponse.json(
        { error: 'libraryId is required' },
        { status: 400 }
      );
    }

    // Validate libraryId
    if (!LIBRARY_IDS.includes(libraryId)) {
      return NextResponse.json(
        { error: `Invalid libraryId. Must be one of: ${LIBRARY_IDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check library access
    const hasAccess = await canManageLibrary(session.user.id, libraryId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this library' },
        { status: 403 }
      );
    }

    // Validate file type
    const mimeType = file.type || 'application/octet-stream';
    if (!documentAdapter.isSupported(mimeType)) {
      return NextResponse.json(
        { error: `File type not supported: ${mimeType}. Supported types: PDF, DOCX, DOC, TXT, MD, CSV, XLSX, XLS` },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file type using magic bytes (prevents spoofing)
    const validation = validateFileType(buffer, mimeType);
    if (!validation.isValid) {
      console.warn('[Upload Document] File validation failed:', {
        filename: file.name,
        declaredType: mimeType,
        detectedType: validation.detectedType,
        mismatch: validation.mismatch,
      });

      return NextResponse.json(
        {
          error: 'File validation failed',
          details: validation.error ||
            'This file does not appear to be a valid document. Supported types: PDF, DOCX, TXT, etc.',
        },
        { status: 400 }
      );
    }

    // Extract file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    // Generate S3 key
    const s3Key = generateS3Key(fileExtension, file.name, `${libraryId}_${Date.now()}`);

    // Upload to S3
    await uploadToS3(s3Key, buffer, mimeType);

    // Process and stage the document using the adapter
    const stagedSource = await documentAdapter.processAndStage(
      {
        name: file.name,
        type: mimeType,
        size: file.size,
        buffer,
      },
      {
        libraryId,
        s3Key,
        bucket: process.env.S3_DOCUMENTS_BUCKET,
        uploadedBy: session.user.email || session.user.id,
      }
    );

    // Stage the source through the unified API
    // Note: The S3 URL (s3Uri) is constructed from s3Key and bucket stored in metadata
    const source = await stageSource({
      sourceType: 'document',
      externalId: stagedSource.externalId,
      libraryId,
      ...(customerId && { customerId }),
      title: stagedSource.title,
      content: stagedSource.content || undefined,
      contentPreview: stagedSource.contentPreview || undefined,
      metadata: stagedSource.metadata,
      stagedBy: session.user.id,
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload document' },
      { status: 500 }
    );
  }
}
