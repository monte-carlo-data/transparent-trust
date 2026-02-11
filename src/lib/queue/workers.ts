/**
 * Background Job Workers (v2)
 *
 * Processes jobs from the queues. Workers should run in a separate process
 * or container from the Next.js API server for better resource isolation.
 *
 * Start workers with: node -r tsx/register src/lib/queue/workers.ts
 * Or deploy as a separate service in AWS (ECS task, Lambda, etc.)
 */

import { Worker, Job } from "bullmq";
import { Prisma } from "@prisma/client";
import {
  getRedisConnection,
  QUEUE_NAMES,
  QueueName,
  logQueueEvent,
  logQueueError,
} from "./config";
import type {
  FileProcessingJobData,
  SkillGenerationJobData,
  BulkOperationsJobData,
  AnalyticsJobData,
  IntegrationDiscoveryJobData,
} from "./client";

// Worker instances
const workers: Worker[] = [];

/**
 * File Processing Worker
 */
async function processFileJob(job: Job<FileProcessingJobData>): Promise<unknown> {
  logQueueEvent("Processing file job", QUEUE_NAMES.FILE_PROCESSING, job.id, {
    type: job.data.type,
    fileId: job.data.fileId,
  });

  switch (job.data.type) {
    case "parse_document":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await job.updateProgress(100);
      return { success: true, fileId: job.data.fileId };

    case "generate_embeddings":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await job.updateProgress(100);
      return { success: true, fileId: job.data.fileId };

    case "extract_metadata":
      await job.updateProgress(100);
      return { success: true, fileId: job.data.fileId };

    default:
      throw new Error(`Unknown file processing job type: ${(job.data as { type: string }).type}`);
  }
}

/**
 * Block Generation Worker (formerly Skill Generation)
 */
async function processBlockJob(job: Job<SkillGenerationJobData>): Promise<unknown> {
  logQueueEvent("Processing block job", QUEUE_NAMES.SKILL_GENERATION, job.id, {
    type: job.data.type,
    skillId: job.data.skillId,
  });

  switch (job.data.type) {
    case "generate_from_document":
      await job.updateProgress(33);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await job.updateProgress(66);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await job.updateProgress(100);
      return { success: true, skillId: job.data.skillId };

    case "refresh_skill":
      // TODO: Implement block refresh with v2 service
      await job.updateProgress(100);
      return { success: true, skillId: job.data.skillId, message: "Block refresh not yet implemented" };

    case "analyze_coherence":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await job.updateProgress(100);
      return { success: true };

    default:
      throw new Error(`Unknown block job type: ${(job.data as { type: string }).type}`);
  }
}

/**
 * Bulk Operations Worker
 */
async function processBulkJob(job: Job<BulkOperationsJobData>): Promise<unknown> {
  logQueueEvent("Processing bulk job", QUEUE_NAMES.BULK_OPERATIONS, job.id, {
    type: job.data.type,
  });

  switch (job.data.type) {
    case "import_customers":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await job.updateProgress(100);
      return { success: true, imported: 0 };

    case "export_data":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await job.updateProgress(100);
      return { success: true, path: job.data.outputPath };

    case "sync_salesforce":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await job.updateProgress(100);
      return { success: true, synced: 0 };

    case "sync_snowflake":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await job.updateProgress(100);
      return { success: true, synced: 0 };

    case "process_project_answers": {
      const { projectId, batchSize } = job.data;
      if (!projectId) {
        throw new Error("projectId is required for process_project_answers");
      }

      // Dynamic import to avoid circular dependencies
      const { processProjectBatches } = await import("@/lib/v2/rfp/batch-processor");

      const result = await processProjectBatches({
        projectId,
        skillIds: (job.data as { skillIds?: string[] }).skillIds || [],
        batchSize: batchSize || 25,
        libraryId: ((job.data as { libraryId?: string }).libraryId || "knowledge") as "knowledge" | "it" | "gtm" | "talent" | "customers" | "prompts",
        modelSpeed: ((job.data as { modelSpeed?: string }).modelSpeed || "quality") as "fast" | "quality",
        onBatchComplete: async (batchNumber, totalBatches, processedCount) => {
          const progress = Math.round((batchNumber / totalBatches) * 100);
          await job.updateProgress(progress);
          logQueueEvent("Batch progress", QUEUE_NAMES.BULK_OPERATIONS, job.id, {
            batchNumber,
            totalBatches,
            processedCount,
            progress,
          });
        },
      });

      return {
        success: true,
        ...result,
      };
    }

    default:
      throw new Error(`Unknown bulk job type: ${(job.data as { type: string }).type}`);
  }
}

/**
 * Analytics Worker
 */
async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<unknown> {
  logQueueEvent("Processing analytics job", QUEUE_NAMES.ANALYTICS, job.id, {
    type: job.data.type,
  });

  switch (job.data.type) {
    case "generate_report":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await job.updateProgress(100);
      return { success: true, reportType: job.data.reportType };

    case "calculate_metrics":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await job.updateProgress(100);
      return { success: true };

    case "cleanup_old_data":
      await job.updateProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await job.updateProgress(100);
      return { success: true, deleted: 0 };

    default:
      throw new Error(`Unknown analytics job type: ${(job.data as { type: string }).type}`);
  }
}

/**
 * Integration Discovery Worker
 */
async function processDiscoveryJob(job: Job<IntegrationDiscoveryJobData>): Promise<unknown> {
  logQueueEvent("Processing discovery job", QUEUE_NAMES.INTEGRATION_DISCOVERY, job.id, {
    type: job.data.type,
    integrationType: job.data.integrationType,
  });

  try {
    const { connectionId, integrationType, libraryId } = job.data;

    // Dynamically import the appropriate adapter
    let adapterModule;
    switch (integrationType) {
      case "slack":
        adapterModule = await import("@/lib/v2/sources/adapters/slack-adapter");
        break;
      case "zendesk":
        adapterModule = await import("@/lib/v2/sources/adapters/zendesk-adapter");
        break;
      case "notion":
        adapterModule = await import("@/lib/v2/sources/adapters/notion-adapter");
        break;
      default:
        throw new Error(`Unknown integration type: ${integrationType}`);
    }

    // Get adapter class and instantiate
    interface DiscoveryAdapter {
      discover(options: {
        connectionId: string;
        libraryId: string;
        customerId?: string;
        since: Date;
        limit: number;
      }): Promise<Array<{
        externalId: string;
        title: string;
        content?: string;
        contentPreview?: string;
        metadata?: Record<string, unknown>;
      }>>;
    }

    const AdapterClass = Object.values(adapterModule).find(
      (val) => typeof val === "function" && val.prototype
    ) as unknown as new (...args: unknown[]) => DiscoveryAdapter;

    if (!AdapterClass) {
      throw new Error(`Could not find adapter class for ${integrationType}`);
    }

    const adapter: DiscoveryAdapter = new AdapterClass();
    await job.updateProgress(25);

    const { prisma } = await import("@/lib/prisma");
    const connection = await prisma.integrationConnection.findFirst({
      where: { id: connectionId, status: "ACTIVE" },
    });

    // Validate connection exists before accessing config
    if (!connection) {
      const error = new Error(`Integration connection ${connectionId} not found or is inactive`);
      logQueueError(
        "Discovery job: connection not found",
        QUEUE_NAMES.INTEGRATION_DISCOVERY,
        error,
        job.id,
        {
          connectionId,
          integrationType,
          libraryId,
          errorId: "discovery_connection_missing",
        }
      );
      throw error;
    }

    const connectionConfig = (connection.config as Record<string, unknown>) || {};
    const customerId =
      typeof connectionConfig.customerId === "string"
        ? connectionConfig.customerId
        : undefined;

    // Discover sources
    const discovered = await adapter.discover({
      connectionId,
      libraryId,
      customerId,
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 100,
    });

    await job.updateProgress(50);

    // Stage discovered sources
    let staged = 0;

    for (const source of discovered) {
      const existing = await prisma.stagedSource.findFirst({
        where: {
          sourceType: integrationType,
          externalId: source.externalId,
          libraryId,
          customerId: customerId || null,
        },
      });

      if (existing) {
        await prisma.stagedSource.update({
          where: { id: existing.id },
          data: {
            title: source.title,
            content: source.content,
            contentPreview: source.contentPreview,
            metadata: source.metadata as Prisma.InputJsonValue,
            stagedAt: new Date(),
            stagedBy: "system:discovery-worker",
          },
        });
      } else {
        await prisma.stagedSource.create({
          data: {
            sourceType: integrationType,
            externalId: source.externalId,
            libraryId,
            customerId: customerId || null,
            title: source.title,
            content: source.content,
            contentPreview: source.contentPreview,
            metadata: source.metadata as Prisma.InputJsonValue,
            stagedBy: "system:discovery-worker",
          },
        });
      }
      staged++;
    }

    await job.updateProgress(100);

    logQueueEvent("Discovery job completed", QUEUE_NAMES.INTEGRATION_DISCOVERY, job.id, {
      integrationType,
      discovered: discovered.length,
      staged,
    });

    return {
      success: true,
      integrationType,
      discovered: discovered.length,
      staged,
      connectionId,
    };
  } catch (error) {
    logQueueError(
      `Discovery job failed for ${job.data.integrationType}`,
      QUEUE_NAMES.INTEGRATION_DISCOVERY,
      error instanceof Error ? error : new Error(String(error)),
      job.id,
      {
        integrationType: job.data.integrationType,
        connectionId: job.data.connectionId,
        libraryId: job.data.libraryId,
        errorId: "discovery_job_failed",
      }
    );
    throw error;
  }
}

/**
 * Create and start a worker for a specific queue
 */
function createWorker(
  queueName: QueueName,
  processor: (job: Job) => Promise<unknown>
): Worker {
  const connection = getRedisConnection();

  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });

  worker.on("completed", (job) => {
    logQueueEvent("Job completed", queueName, job.id, {
      returnvalue: job.returnvalue,
    });
  });

  worker.on("failed", (job, error) => {
    logQueueError("Job failed", queueName, error, job?.id, {
      attemptsMade: job?.attemptsMade,
      failedReason: job?.failedReason,
    });
  });

  worker.on("error", (error) => {
    logQueueError("Worker error", queueName, error);
  });

  workers.push(worker);
  logQueueEvent("Worker started", queueName);

  return worker;
}

/**
 * Start all workers
 */
export function startWorkers(): void {
  createWorker(QUEUE_NAMES.FILE_PROCESSING, processFileJob);
  createWorker(QUEUE_NAMES.SKILL_GENERATION, processBlockJob);
  createWorker(QUEUE_NAMES.BULK_OPERATIONS, processBulkJob);
  createWorker(QUEUE_NAMES.ANALYTICS, processAnalyticsJob);
  createWorker(QUEUE_NAMES.INTEGRATION_DISCOVERY, processDiscoveryJob);

  logQueueEvent("All workers started", "system");
}

/**
 * Stop all workers (graceful shutdown)
 */
export async function stopWorkers(): Promise<void> {
  logQueueEvent("Stopping workers", "system");

  const closePromises = workers.map((worker) => worker.close());
  await Promise.all(closePromises);

  logQueueEvent("All workers stopped", "system");
}

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await stopWorkers();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Run workers as standalone process
 */
if (require.main === module) {
  console.log("Starting background job workers...");
  setupGracefulShutdown();
  startWorkers();
}
