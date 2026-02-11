/**
 * Background Job Queue Client
 *
 * Provides a simple interface for adding jobs to background queues
 */

import { Queue, QueueOptions } from "bullmq";
import {
  getRedisConnection,
  isQueueConfigured,
  QUEUE_NAMES,
  QueueName,
  DEFAULT_JOB_OPTIONS,
  logQueueEvent,
  logQueueError,
} from "./config";

// Queue instances (lazy initialization)
const queues = new Map<QueueName, Queue>();

/**
 * Get or create a queue instance
 */
function getQueue(queueName: QueueName): Queue {
  if (!isQueueConfigured()) {
    throw new Error(
      "Background job queue not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
    );
  }

  if (!queues.has(queueName)) {
    const connection = getRedisConnection();

    const queueOptions: QueueOptions = {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    };

    const queue = new Queue(queueName, queueOptions);

    // Set up event listeners
    queue.on("error", (error) => {
      logQueueError("Queue error", queueName, error);
    });

    queues.set(queueName, queue);
    logQueueEvent("Queue initialized", queueName);
  }

  return queues.get(queueName)!;
}

/**
 * Job type definitions
 */

// File Processing Jobs
export type FileProcessingJobData = {
  type: "parse_document" | "generate_embeddings" | "extract_metadata" | "batch_document_upload";
  fileId?: string;
  filePath?: string;
  s3Key?: string;
  customerId?: string;
  userId?: string;
  userEmail?: string;
  documentIds?: string[];
  processForContent?: boolean[];
};

// Skill Generation Jobs
export type SkillGenerationJobData = {
  type: "generate_from_document" | "refresh_skill" | "analyze_coherence";
  skillId?: string;
  documentId?: string;
  documentContent?: string;
  userId?: string;
  userEmail?: string;
};

// Bulk Operations Jobs
export type BulkOperationsJobData = {
  type: "import_customers" | "export_data" | "sync_salesforce" | "sync_snowflake" | "process_project_answers" | "process_contract_analysis";
  userId?: string;
  userEmail?: string;
  filters?: Record<string, unknown>;
  outputPath?: string;
  // For process_project_answers and process_contract_analysis
  projectId?: string;
  skillIds?: string[];
  batchSize?: number;
  batchDelayMs?: number;
  libraryId?: string;
  modelSpeed?: string;
};

// Analytics Jobs
export type AnalyticsJobData = {
  type: "generate_report" | "calculate_metrics" | "cleanup_old_data";
  reportType?: string;
  dateRange?: { start: Date; end: Date };
};

// Contract Analysis Jobs
export type ContractAnalysisJobData = {
  type: "analyze_contract";
  contractId: string;
  userId?: string;
  userEmail?: string | null;
};

// Integration Discovery Jobs
export type IntegrationDiscoveryJobData = {
  type: "discover_integration";
  connectionId: string;
  integrationType: "slack" | "zendesk" | "notion";
  libraryId: string;
  userId?: string;
  userEmail?: string;
};

type JobData =
  | FileProcessingJobData
  | SkillGenerationJobData
  | BulkOperationsJobData
  | AnalyticsJobData
  | ContractAnalysisJobData
  | IntegrationDiscoveryJobData;

/**
 * Add a job to the queue
 */
export async function addJob<T extends JobData>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    removeOnComplete?: boolean;
  }
): Promise<string> {
  const queue = getQueue(queueName);

  const job = await queue.add(jobName, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
  });

  logQueueEvent("Job added", queueName, job.id, { jobName, data });

  return job.id!;
}

/**
 * Get job status
 */
export async function getJobStatus(
  queueName: QueueName,
  jobId: string
): Promise<{
  state: string;
  progress?: number;
  returnvalue?: unknown;
  failedReason?: string;
}> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    throw new Error(`Job ${jobId} not found in queue ${queueName}`);
  }

  const state = await job.getState();
  // BullMQ progress can be number, string, boolean, or object - normalize to number or undefined
  const rawProgress = job.progress;
  let progress: number | undefined;
  if (typeof rawProgress === "number") {
    progress = rawProgress;
  } else if (typeof rawProgress === "string") {
    progress = parseInt(rawProgress, 10) || 0;
  } else if (typeof rawProgress === "boolean") {
    progress = rawProgress ? 100 : 0;
  }
  const returnvalue = job.returnvalue;
  const failedReason = job.failedReason;

  return { state, progress, returnvalue, failedReason };
}

/**
 * Wait for job completion (with polling)
 */
export async function waitForJob<T = unknown>(
  queueName: QueueName,
  jobId: string,
  timeoutMs: number = 60000
): Promise<T> {
  const queue = getQueue(queueName);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queueName}`);
    }

    const state = await job.getState();
    if (state === "completed") {
      return job.returnvalue as T;
    }
    if (state === "failed") {
      throw new Error(job.failedReason || "Job failed");
    }

    // Poll every 500ms
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

/**
 * Remove a job from the queue
 */
export async function removeJob(
  queueName: QueueName,
  jobId: string
): Promise<void> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (job) {
    await job.remove();
    logQueueEvent("Job removed", queueName, jobId);
  }
}

/**
 * Close all queue connections (for graceful shutdown)
 */
export async function closeQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((queue) =>
    queue.close()
  );
  await Promise.all(closePromises);
  queues.clear();
  logQueueEvent("All queues closed", "system");
}

// Export queue names for convenience
export { QUEUE_NAMES };
