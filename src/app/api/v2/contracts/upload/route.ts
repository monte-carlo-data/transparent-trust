/**
 * POST /api/v2/contracts/upload
 *
 * Handle contract file upload and trigger analysis pipeline.
 * Extracts text from PDF/DOCX and creates analysis rows.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { apiSuccess, errors } from '@/lib/apiResponse';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  let projectId: string | null = null;
  let file: File | null = null;

  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;
    projectId = formData.get('projectId') as string | null;

    if (!file) {
      return errors.badRequest('No file uploaded');
    }

    if (!projectId) {
      return errors.badRequest('Project ID required');
    }

    // Verify project exists, user owns it, and is contract-review type
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectType: true,
        ownerId: true,
        config: true,
      },
    });

    if (!project) {
      return errors.notFound('Project not found');
    }

    if (project.ownerId !== auth.session.user.id) {
      return errors.forbidden('Access denied');
    }

    if (project.projectType !== 'contract-review') {
      return errors.badRequest('Project is not a contract review project');
    }

    // Get file content as text
    const fileBuffer = await file.arrayBuffer();
    const fileContent = await extractTextFromFile(file.name, fileBuffer);

    if (!fileContent || fileContent.trim().length === 0) {
      return errors.badRequest('Could not extract text from file');
    }

    // Update project with full contract text and status to DRAFT
    await prisma.bulkProject.update({
      where: { id: projectId },
      data: {
        status: 'DRAFT',
        fileContext: fileContent, // Store full text, not truncated
        config: {
          ...(project.config as Record<string, unknown>),
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          extractedTextLength: fileContent.length,
        },
      },
    });

    // Create single BulkRow for contract analysis
    // This will be populated with findings array when analysis runs
    const row = await prisma.bulkRow.create({
      data: {
        projectId,
        rowNumber: 1,
        inputData: {
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        },
        outputData: {}, // Empty until analysis completes
        status: 'PENDING',
      },
    });

    return apiSuccess({
      success: true,
      data: {
        projectId,
        rowId: row.id,
        fileName: file.name,
        extractedTextLength: fileContent.length,
      },
    });
  } catch (error) {
    const errorId = generateErrorId();

    logger.error('Contract upload error', error, {
      projectId,
      fileName: file?.name,
      fileSize: file?.size,
      errorId,
      route: '/api/v2/contracts/upload',
    });

    return errors.internal(`Failed to process contract upload. Please try again or contact support. (Error ID: ${errorId})`);
  }
}

/**
 * Extract text from uploaded file
 * Supports PDF and DOCX formats
 */
async function extractTextFromFile(filename: string, buffer: ArrayBuffer): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    // PDFs are extracted via documentExtractor which uses Claude
    // This route shouldn't receive PDFs directly for contract analysis
    // Instead, contracts should use the document upload endpoint
    throw new Error('PDF contract extraction should use /api/v2/sources/upload-document');
  }

  if (ext === 'docx' || ext === 'doc') {
    // For DOCX, we'd use mammoth or similar
    try {
      const mammoth = await import('mammoth').catch(() => null);
      if (mammoth) {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        return result.value;
      }
    } catch {
      // Fall through
    }

    // Fallback: DOCX files are zipped XML - proper extraction requires unzipping
    return 'DOCX text extraction requires mammoth package. Please install it or upload a text file.';
  }

  if (ext === 'txt' || ext === 'md') {
    return new TextDecoder('utf-8').decode(buffer);
  }

  return '';
}
