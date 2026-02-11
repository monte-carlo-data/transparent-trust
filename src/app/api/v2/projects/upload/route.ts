/**
 * V2 Projects File Upload API Route
 *
 * Handle file uploads (Excel/CSV) for bulk projects with structure detection
 */

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { apiSuccess, errors } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { StructuredUploadParser } from "@/lib/v2/rfp/structured-upload-parser";
import type { LibraryId } from "@/types/v2";
import { canAccessCustomer } from "@/lib/v2/customers/customer-service";

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const userId = auth.session.user.id;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const excludedSheetsJson = formData.get("excludedSheets") as string | null;
    const questionColumn = formData.get("questionColumn") as string | null;
    const questionColumnMapJson = formData.get("questionColumnMap") as string | null;
    const selectedRowsBySheetJson = formData.get("selectedRowsBySheet") as string | null;
    // libraryId is passed through for use in approval phase skill matching
    const libraryId = (formData.get("libraryId") || "knowledge") as LibraryId;
    // customerId for linking RFP to a specific customer
    const customerId = formData.get("customerId") as string | null;

    // Verify user has access to the customer if linking to one
    if (customerId) {
      const hasAccess = await canAccessCustomer(userId, customerId);
      if (!hasAccess) {
        return errors.forbidden("You do not have access to this customer");
      }
    }

    if (!file) {
      return errors.badRequest("No file provided");
    }

    const fileName = file.name;
    const buffer = await file.arrayBuffer();

    // Parse excluded sheets if provided - fail explicitly on malformed JSON
    let excludedSheets: string[] = [];
    if (excludedSheetsJson) {
      try {
        excludedSheets = JSON.parse(excludedSheetsJson);
        if (!Array.isArray(excludedSheets) || !excludedSheets.every(s => typeof s === 'string')) {
          return errors.badRequest("excludedSheets must be a JSON array of strings");
        }
      } catch (e) {
        logger.error("Failed to parse excludedSheets", e, { excludedSheetsJson });
        return errors.badRequest("Invalid excludedSheets format - must be valid JSON array");
      }
    }

    // Parse question column map if provided - fail explicitly on malformed JSON
    let questionColumnMap: Record<string, string> | undefined;
    if (questionColumnMapJson) {
      try {
        questionColumnMap = JSON.parse(questionColumnMapJson);
        if (typeof questionColumnMap !== 'object' || questionColumnMap === null || Array.isArray(questionColumnMap)) {
          return errors.badRequest("questionColumnMap must be a JSON object");
        }
        for (const [sheet, column] of Object.entries(questionColumnMap)) {
          if (typeof column !== 'string') {
            return errors.badRequest(`questionColumnMap value for sheet "${sheet}" must be a string`);
          }
        }
      } catch (e) {
        logger.error("Failed to parse questionColumnMap", e, { questionColumnMapJson });
        return errors.badRequest("Invalid questionColumnMap format - must be valid JSON object");
      }
    }

    // Parse selected rows by sheet if provided - fail explicitly on malformed JSON
    let selectedRowsBySheet: Record<string, number[]> | undefined;
    if (selectedRowsBySheetJson) {
      try {
        selectedRowsBySheet = JSON.parse(selectedRowsBySheetJson);
        if (typeof selectedRowsBySheet !== 'object' || selectedRowsBySheet === null || Array.isArray(selectedRowsBySheet)) {
          return errors.badRequest("selectedRowsBySheet must be a JSON object");
        }
        for (const [sheet, indices] of Object.entries(selectedRowsBySheet)) {
          if (!Array.isArray(indices) || !indices.every(i => typeof i === 'number')) {
            return errors.badRequest(`selectedRowsBySheet value for sheet "${sheet}" must be an array of numbers`);
          }
        }
      } catch (e) {
        logger.error("Failed to parse selectedRowsBySheet", e, { selectedRowsBySheetJson });
        return errors.badRequest("Invalid selectedRowsBySheet format - must be valid JSON object");
      }
    }

    // Parse file: use simple row-by-row parsing for wizard uploads (with columnMapping),
    // otherwise use structure detection for traditional bulk uploads
    const isWizardUpload = !!questionColumnMap;
    let parseResult;

    if (isWizardUpload) {
      // Wizard mode: simple one-cluster-per-sheet parsing
      parseResult = await StructuredUploadParser.parseFileForWizard(
        buffer,
        fileName,
        excludedSheets,
        questionColumnMap,
        selectedRowsBySheet
      );
    } else {
      // Legacy mode: structure detection with section clustering
      parseResult = await StructuredUploadParser.parseFile(
        buffer,
        fileName,
        excludedSheets,
        questionColumn || undefined,
        questionColumnMap
      );
    }

    if (parseResult.clusters.length === 0 || parseResult.metadata.totalQuestions === 0) {
      return errors.badRequest("No valid data found in file");
    }

    // Parse file structure for display purposes
    // Questions are stored flat (no clustering)
    const finalClusters = parseResult.clusters;

    // Build file context from parsed clusters
    const fileContextParts: string[] = [];
    for (const cluster of parseResult.clusters) {
      fileContextParts.push(`# ${cluster.title}`);
      if (cluster.description) {
        fileContextParts.push(cluster.description);
      }
      fileContextParts.push('');

      for (const q of cluster.questions) {
        fileContextParts.push(`Q: ${q.question}`);
        if (q.context) {
          fileContextParts.push(`Context: ${q.context}`);
        }
        if (q.category) {
          fileContextParts.push(`Category: ${q.category}`);
        }
        fileContextParts.push('');
      }
      fileContextParts.push('---\n');
    }

    const fileContext = fileContextParts.join('\n');
    const fileContextTokens = Math.ceil(fileContext.length / 4); // Rough estimate: 1 token ≈ 4 chars

    // Create project
    const projectName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
    const project = await prisma.bulkProject.create({
      data: {
        name: projectName,
        projectType: "rfp",
        ownerId: userId,
        status: "DRAFT",
        fileContext,
        fileContextTokens,
        customerId: customerId || undefined,
        config: {
          detectedStructure: {
            hasStructure: parseResult.metadata.hasStructure,
            sheetsDetected: parseResult.metadata.sheetsDetected,
            sectionsDetected: parseResult.metadata.sectionsDetected,
          },
          libraryId, // Store for use in skill matching phase
        } as Prisma.InputJsonValue,
      },
    });

    // Create flat list of questions (never assigned to clusters)
    // All questions processed with same skill set via /process-batch
    let globalRowNumber = 1;
    const allQuestions: Prisma.BulkRowCreateManyInput[] = [];

    for (const clusterConfig of finalClusters) {
      for (const question of clusterConfig.questions) {
        allQuestions.push({
          projectId: project.id,
          rowNumber: globalRowNumber++,
          inputData: {
            question: question.question,
            ...(question.context && { context: question.context }),
            ...(question.category && { category: question.category }),
            // Preserve original file location for reference
            originalSheetName: clusterConfig.title,
            originalRowIndex: question.originalRowIndex,
          } as Prisma.InputJsonValue,
          outputData: {} as Prisma.InputJsonValue,
          status: "PENDING",
        });
      }
    }

    // Bulk create all questions
    if (allQuestions.length > 0) {
      await prisma.bulkRow.createMany({
        data: allQuestions,
      });
    }

    // Return project with stats
    const project_with_stats = await prisma.bulkProject.findUnique({
      where: { id: project.id },
      include: {
        _count: {
          select: { rows: true },
        },
      },
    });

    return apiSuccess(
      {
        success: true,
        data: {
          project: {
            ...project_with_stats,
            rowCount: project_with_stats?._count.rows || 0,
          },
          structure: parseResult.metadata,
        },
      },
      201
    );
  } catch (error) {
    logger.error("Upload project error", error, { route: "/api/v2/projects/upload" });

    if (error instanceof Error) {
      return errors.badRequest(error.message);
    }

    return errors.internal("Failed to upload project");
  }
}
