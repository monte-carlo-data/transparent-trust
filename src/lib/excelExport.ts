import ExcelJS from "exceljs";
import { BulkProject, BulkRow } from "@/types/bulkProject";

export type ExportOptions = {
  includeIncomplete?: boolean; // Include rows without responses (default: true)
  confidenceFilter?: "all" | "high" | "medium" | "low" | "unable"; // Filter by confidence level
  includeMetadata?: boolean; // Include summary sheet (default: true)
  includeTransparency?: boolean; // Include transparency details sheet (default: false)
};

const DEFAULT_OPTIONS: ExportOptions = {
  includeIncomplete: true,
  confidenceFilter: "all",
  includeMetadata: true,
};

function getConfidenceLevel(confidence?: string): "high" | "medium" | "low" | "unable" | null {
  if (!confidence) return null;
  const lower = confidence.toLowerCase();
  if (lower.includes("high")) return "high";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("low")) return "low";
  if (lower.includes("unable")) return "unable";
  return null;
}

function filterRows(rows: BulkRow[], options: ExportOptions): BulkRow[] {
  let filtered = [...rows];

  // Filter incomplete rows
  if (!options.includeIncomplete) {
    filtered = filtered.filter((row) => row.response && row.response.trim().length > 0);
  }

  // Filter by confidence level
  if (options.confidenceFilter && options.confidenceFilter !== "all") {
    filtered = filtered.filter((row) => {
      const level = getConfidenceLevel(row.confidence);
      return level === options.confidenceFilter;
    });
  }

  return filtered;
}

function calculateStats(rows: BulkRow[]) {
  const total = rows.length;
  const completed = rows.filter((r) => r.response && r.response.trim().length > 0).length;
  const pending = total - completed;

  const highConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "high").length;
  const mediumConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "medium").length;
  const lowConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "low").length;
  const unableConfidence = rows.filter((r) => getConfidenceLevel(r.confidence) === "unable").length;

  return {
    total,
    completed,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    unableConfidence,
  };
}

async function createSummarySheet(
  workbook: ExcelJS.Workbook,
  project: BulkProject,
  stats: ReturnType<typeof calculateStats>
): Promise<void> {
  const worksheet = workbook.addWorksheet("Summary");

  const data = [
    ["Project Summary"],
    [],
    ["Project Name", project.name],
    ["Customer", project.customer?.name || project.customerName || "Not specified"],
    ["Owner", project.owner?.name || project.ownerName || "Not specified"],
    ["Status", formatStatus(project.status)],
    ["Created", formatDate(project.createdAt)],
    ["Last Modified", formatDate(project.lastModifiedAt)],
    [],
    ["Completion Statistics"],
    [],
    ["Total Questions", stats.total],
    ["Completed", stats.completed],
    ["Pending", stats.pending],
    ["Completion Rate", `${stats.completionRate}%`],
    [],
    ["Confidence Breakdown"],
    [],
    ["High Confidence", stats.highConfidence],
    ["Medium Confidence", stats.mediumConfidence],
    ["Low Confidence", stats.lowConfidence],
    ["Unable to Answer", stats.unableConfidence],
  ];

  // Add review info if available
  if (project.reviewRequestedBy) {
    data.push([], ["Review Information"], []);
    data.push(["Requested By", project.reviewRequestedBy]);
    data.push(["Requested At", formatDate(project.reviewRequestedAt)]);
    if (project.reviewedBy) {
      data.push(["Approved By", project.reviewedBy]);
      data.push(["Approved At", formatDate(project.reviewedAt)]);
    }
  }

  worksheet.addRows(data);

  // Set column widths
  worksheet.columns = [{ width: 20 }, { width: 50 }];

  // Merge title cells
  worksheet.mergeCells("A1:B1"); // Project Summary title
  worksheet.mergeCells("A10:B10"); // Completion Statistics title
  worksheet.mergeCells("A17:B17"); // Confidence Breakdown title
}

// Extract URLs from text and return as array
function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s,\n)>\]]+/gi;
  return text.match(urlRegex) || [];
}

// Format sources with hyperlinks for Excel
function formatSourcesForExcel(sources: string): string {
  if (!sources) return "";
  const urls = extractUrls(sources);
  if (urls.length === 0) return sources;

  // Return URLs as newline-separated list for cleaner display
  // Each URL will be made clickable via cell hyperlink
  return urls.join("\n");
}

async function createResponsesSheet(workbook: ExcelJS.Workbook, rows: BulkRow[]): Promise<void> {
  // Check if we have multiple source tabs
  const uniqueTabs = new Set(rows.map((r) => r.sourceTab).filter(Boolean));
  const hasMultipleTabs = uniqueTabs.size > 1;

  const worksheet = workbook.addWorksheet("Q&A");

  // Headers - include Source Tab column only if there are multiple tabs
  const headers = hasMultipleTabs
    ? ["Source Tab", "Row #", "Question", "Answer", "Status", "Confidence", "Reasoning", "Inference", "Sources", "Remarks"]
    : ["Row #", "Question", "Answer", "Status", "Confidence", "Reasoning", "Inference", "Sources", "Remarks"];

  worksheet.addRow(headers);

  // Add rows
  rows.forEach((row) => {
    const status = row.response && row.response.trim().length > 0 ? "Completed" : "Pending";
    const formattedSources = formatSourcesForExcel(row.sources || "");
    const rowData = hasMultipleTabs
      ? [
          row.sourceTab || "",
          row.rowNumber.toString(),
          row.question,
          row.response || "",
          status,
          row.confidence || "",
          row.reasoning || "",
          row.inference || "None",
          formattedSources,
          row.remarks || "",
        ]
      : [
          row.rowNumber.toString(),
          row.question,
          row.response || "",
          status,
          row.confidence || "",
          row.reasoning || "",
          row.inference || "None",
          formattedSources,
          row.remarks || "",
        ];
    worksheet.addRow(rowData);
  });

  // Add hyperlinks to source URLs
  const sourcesColIndex = hasMultipleTabs ? 9 : 8; // 1-indexed column for Sources
  rows.forEach((row, rowIndex) => {
    const urls = extractUrls(row.sources || "");
    if (urls.length > 0) {
      const cell = worksheet.getCell(rowIndex + 2, sourcesColIndex); // +2 for header row and 1-indexed
      // For single URL, make the cell itself a hyperlink
      if (urls.length === 1) {
        cell.value = {
          text: formatSourcesForExcel(row.sources || ""),
          hyperlink: urls[0],
          tooltip: "Click to open source",
        };
      }
      // For multiple URLs, add hyperlink to first URL
      else {
        cell.value = {
          text: formatSourcesForExcel(row.sources || ""),
          hyperlink: urls[0],
          tooltip: `Click to open first source (${urls.length} total)`,
        };
      }
    }
  });

  // Set column widths
  if (hasMultipleTabs) {
    worksheet.columns = [
      { width: 15 }, // Source Tab
      { width: 8 }, // Row #
      { width: 50 }, // Question
      { width: 80 }, // Answer
      { width: 12 }, // Status
      { width: 15 }, // Confidence
      { width: 50 }, // Reasoning
      { width: 50 }, // Inference
      { width: 40 }, // Sources
      { width: 40 }, // Remarks
    ];
  } else {
    worksheet.columns = [
      { width: 8 }, // Row #
      { width: 50 }, // Question
      { width: 80 }, // Answer
      { width: 12 }, // Status
      { width: 15 }, // Confidence
      { width: 50 }, // Reasoning
      { width: 50 }, // Inference
      { width: 40 }, // Sources
      { width: 40 }, // Remarks
    ];
  }

  // Set header row height for better readability
  worksheet.getRow(1).height = 30;
}

async function createTransparencySheet(workbook: ExcelJS.Workbook, rows: BulkRow[]): Promise<void> {
  const worksheet = workbook.addWorksheet("Transparency");

  // Headers
  const headers = [
    "Row #",
    "Question",
    "Composition ID",
    "Block IDs",
    "Runtime Block IDs",
    "Model",
    "Assembled At",
    "Trace ID",
  ];

  worksheet.addRow(headers);

  // Add rows
  rows.forEach((row) => {
    const transparency = row.transparency;
    const rowData = [
      row.rowNumber.toString(),
      row.question,
      transparency?.compositionId || "",
      transparency?.blockIds?.join(", ") || "",
      transparency?.runtimeBlockIds?.join(", ") || "",
      transparency?.model || "",
      transparency?.assembledAt ? formatDate(transparency.assembledAt) : "",
      transparency?.traceId || "",
    ];
    worksheet.addRow(rowData);
  });

  // Set column widths
  worksheet.columns = [
    { width: 8 },   // Row #
    { width: 50 },  // Question
    { width: 20 },  // Composition ID
    { width: 40 },  // Block IDs
    { width: 40 },  // Runtime Block IDs
    { width: 15 },  // Model
    { width: 20 },  // Assembled At
    { width: 20 },  // Trace ID
  ];

  // Set header row height for better readability
  worksheet.getRow(1).height = 30;
}

async function createSystemPromptsSheet(workbook: ExcelJS.Workbook, rows: BulkRow[]): Promise<void> {
  const worksheet = workbook.addWorksheet("System Prompts");

  // Headers
  const headers = ["Row #", "Question", "System Prompt"];
  worksheet.addRow(headers);

  // Add rows
  rows.forEach((row) => {
    const transparency = row.transparency;
    const rowData = [
      row.rowNumber.toString(),
      row.question,
      transparency?.systemPrompt || "",
    ];
    worksheet.addRow(rowData);
  });

  // Set column widths
  worksheet.columns = [
    { width: 8 },    // Row #
    { width: 50 },   // Question
    { width: 150 },  // System Prompt (wider for content)
  ];

  // Set header row height for better readability
  worksheet.getRow(1).height = 30;

  // Enable text wrapping for system prompt column
  for (let i = 0; i < rows.length; i++) {
    const rowTransparency = rows[i].transparency;
    const cellIndex = i + 2; // +1 for header, +1 for 1-indexed
    worksheet.getRow(cellIndex).getCell(3).alignment = {
      wrapText: true,
      vertical: "top",
    };
    const promptLength = rowTransparency?.systemPrompt?.length || 0;
    worksheet.getRow(cellIndex).height = Math.max(20, Math.ceil(promptLength / 100) * 15);
  }
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: "Draft",
    in_progress: "In Progress",
    needs_review: "Needs Review",
    finalized: "Finalized",
  };
  return statusMap[status] || status;
}

function formatDate(dateString?: string): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function exportProjectToExcel(project: BulkProject, options: ExportOptions = {}): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter rows based on options
  const filteredRows = filterRows(project.rows, opts);

  // Calculate stats from original rows (not filtered)
  const stats = calculateStats(project.rows);

  // Create workbook
  const workbook = new ExcelJS.Workbook();

  // Add summary sheet if requested
  if (opts.includeMetadata) {
    await createSummarySheet(workbook, project, stats);
  }

  // Add Q&A sheet
  await createResponsesSheet(workbook, filteredRows);

  // Add transparency details if requested
  if (opts.includeTransparency) {
    await createTransparencySheet(workbook, filteredRows);
    await createSystemPromptsSheet(workbook, filteredRows);
  }

  // Generate filename
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedName = project.name.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const filterSuffix = opts.confidenceFilter !== "all" ? `_${opts.confidenceFilter}` : "";
  const transparencySuffix = opts.includeTransparency ? "_with_transparency" : "";
  const filename = `${sanitizedName}${filterSuffix}${transparencySuffix}_${timestamp}.xlsx`;

  // Write the file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export filtered versions for convenience
export function exportCompletedOnly(project: BulkProject): Promise<void> {
  return exportProjectToExcel(project, { includeIncomplete: false });
}

export function exportHighConfidenceOnly(project: BulkProject): Promise<void> {
  return exportProjectToExcel(project, { confidenceFilter: "high" });
}

export function exportLowConfidenceOnly(project: BulkProject): Promise<void> {
  return exportProjectToExcel(project, { confidenceFilter: "low", includeIncomplete: false });
}

export function exportWithTransparency(project: BulkProject): Promise<void> {
  return exportProjectToExcel(project, { includeTransparency: true });
}

export function exportCompletedWithTransparency(project: BulkProject): Promise<void> {
  return exportProjectToExcel(project, { includeIncomplete: false, includeTransparency: true });
}
