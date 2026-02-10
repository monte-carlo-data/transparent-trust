/**
 * Background Job Queue Examples
 *
 * Demonstrates how to move heavy operations from HTTP request handlers
 * to background jobs for better scalability and user experience.
 *
 * BEFORE (synchronous - blocks HTTP request):
 * ```typescript
 * export async function POST(request: Request) {
 *   const file = await request.formData().get('file');
 *   const content = await heavyFileProcessing(file); // 10-30 seconds
 *   await saveToDatabase(content);
 *   return Response.json({ success: true });
 * }
 * ```
 *
 * AFTER (asynchronous - returns immediately):
 * ```typescript
 * export async function POST(request: Request) {
 *   const file = await request.formData().get('file');
 *   const jobId = await addJob(QUEUE_NAMES.FILE_PROCESSING, 'parse_document', {
 *     type: 'parse_document',
 *     fileId: file.id,
 *     filePath: file.path,
 *   });
 *   return Response.json({ jobId, status: 'processing' });
 * }
 * ```
 */

import { addJob, QUEUE_NAMES, type FileProcessingJobData } from "./client";

/**
 * Example: Move document upload processing to background job
 *
 * Use this pattern in:
 * - /api/customers/[id]/documents/route.ts
 * - /api/projects/upload/route.ts
 */
export async function enqueueDocumentProcessing(params: {
  fileId: string;
  filePath: string;
  customerId?: string;
  userId?: string;
}): Promise<string> {
  const jobData: FileProcessingJobData = {
    type: "parse_document",
    fileId: params.fileId,
    filePath: params.filePath,
    customerId: params.customerId,
    userId: params.userId,
  };

  const jobId = await addJob(
    QUEUE_NAMES.FILE_PROCESSING,
    "parse_document",
    jobData,
    {
      priority: 5, // Higher priority than bulk operations
      attempts: 3,
    }
  );

  return jobId;
}

/**
 * Example: Move skill refresh to background job
 *
 * Use this pattern in:
 * - /api/skills/[id]/refresh/route.ts
 * - /api/skills/groups/analyze-coherence/route.ts
 */
export async function enqueueSkillRefresh(params: {
  skillId: string;
  userId?: string;
}): Promise<string> {
  const jobId = await addJob(
    QUEUE_NAMES.SKILL_GENERATION,
    "refresh_skill",
    {
      type: "refresh_skill",
      skillId: params.skillId,
      userId: params.userId,
    },
    {
      priority: 3,
      attempts: 2,
    }
  );

  return jobId;
}

/**
 * Example: Move Salesforce sync to background job
 *
 * Use this pattern in:
 * - /api/customers/enrich-from-salesforce/route.ts
 * - scripts/sync-customers-to-db.ts
 */
export async function enqueueSalesforceSync(params: {
  userId?: string;
  filters?: Record<string, unknown>;
}): Promise<string> {
  const jobId = await addJob(
    QUEUE_NAMES.BULK_OPERATIONS,
    "sync_salesforce",
    {
      type: "sync_salesforce",
      userId: params.userId,
      filters: params.filters,
    },
    {
      priority: 1, // Lower priority (bulk operations can wait)
      attempts: 2,
    }
  );

  return jobId;
}

/**
 * Pattern for polling job status from the client
 *
 * Frontend can poll the job status endpoint:
 * GET /api/jobs/[jobId]/status
 *
 * Response:
 * {
 *   state: 'completed' | 'active' | 'waiting' | 'failed',
 *   progress: 75,
 *   result?: {...},
 *   error?: string
 * }
 */
