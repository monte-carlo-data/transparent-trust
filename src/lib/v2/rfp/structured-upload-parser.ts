/**
 * Structured RFP Parser
 *
 * Detects and preserves RFP structure (tabs, sections, categories) during upload.
 * Supports Excel (multi-sheet, merged cells, numbering) and CSV (category column).
 */

import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export interface ParsedQuestion {
  question: string;
  context?: string;
  category?: string;
  originalRowIndex: number; // Original row number in the file
}

export interface ClusterConfig {
  type: 'tab' | 'section' | 'default' | 'semantic'; // 'semantic' indicates LLM-generated clustering
  title: string;
  level: number;
  order: number;
  description?: string;
  category?: string;
  questions: ParsedQuestion[];
  parent?: string; // Reference to parent cluster
  skillIds?: string[]; // Skill IDs matched by LLM during cluster creation
}

export interface StructuredUploadResult {
  clusters: ClusterConfig[];
  metadata: {
    totalQuestions: number;
    sheetsDetected: string[];
    sectionsDetected: number;
    hasStructure: boolean;
  };
}

/**
 * Deduplicate header names by appending suffixes for duplicates.
 * E.g., ["Question", "Question", "Answer"] → ["Question", "Question (2)", "Answer"]
 */
function deduplicateHeaders(headers: string[]): string[] {
  const headerSet = new Set<string>();
  return headers.map((headerName) => {
    let uniqueName = headerName;
    let suffix = 2;
    while (headerSet.has(uniqueName)) {
      uniqueName = `${headerName} (${suffix})`;
      suffix++;
    }
    headerSet.add(uniqueName);
    return uniqueName;
  });
}

/**
 * Convert Excel-style column letter to 0-based index (A -> 0, B -> 1, Z -> 25, AA -> 26)
 */
function columnLetterToIndex(letter: string): number {
  let index = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1; // Convert to 0-based
}

/**
 * Detects if a row appears to be a section header based on heuristics
 */
class SectionDetector {
  /**
   * Check if cell value looks like a section number (e.g., "2.1", "2.1.3", "Section 2.1")
   */
  static isSectionNumbering(text: string): { depth: number; isSection: boolean } {
    if (!text) return { depth: 0, isSection: false };

    const trimmed = text.trim();

    // Match patterns: "2", "2.1", "2.1.3", "Section 2.1", "2.1 - Title", etc.
    const patterns = [
      /^(\d+(?:\.\d+)+)(?:\s|$)/, // "2.1", "2.1.3", etc.
      /^[Ss]ection\s+(\d+(?:\.\d+)*)/, // "Section 2.1"
      /^\d+\.\s+/, // "2. Title"
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        // Calculate depth from number of dots + 1
        const depth = (match[1]?.match(/\./g) || []).length + 1;
        return { depth, isSection: true };
      }
    }

    return { depth: 0, isSection: false };
  }

  /**
   * Check if a row contains mostly empty cells (likely a header/separator)
   */
  static isEmptyRow(cells: (string | undefined)[]): boolean {
    const nonEmptyCells = cells.filter(c => c && c.trim()).length;
    return nonEmptyCells === 0 || nonEmptyCells <= 1; // Allow 1 cell (like numbering)
  }

  /**
   * Check if first cell has a section-like pattern
   */
  static isLikelySectionHeader(firstCell: string | undefined, otherCells: (string | undefined)[]): boolean {
    if (!firstCell) return false;

    const { isSection } = this.isSectionNumbering(firstCell);
    if (isSection) return true;

    // Check if all other cells in the row are empty (suggests header row)
    const nonEmptyOthers = otherCells.filter(c => c && c.trim()).length;
    if (nonEmptyOthers === 0 && firstCell.trim()) {
      // Single column with text suggests header
      return true;
    }

    return false;
  }
}

/**
 * Main structured parser for Excel and CSV files
 */
export class StructuredUploadParser {
  /**
   * Normalize ExcelJS cell values to strings for header/question detection.
   */
  private static cellValueToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      const maybe = value as { richText?: Array<{ text?: string }> };
      if (Array.isArray(maybe.richText)) {
        return maybe.richText.map(part => part.text ?? '').join('');
      }
    }
    return String(value);
  }

  private static normalizeHeaderValue(value: unknown, index: number): string {
    const text = this.cellValueToString(value).trim();
    return text.length > 0 ? text : `Column ${index + 1}`;
  }

  /**
   * Parse file and detect structure
   */
  static async parseFile(
    buffer: Buffer | ArrayBuffer,
    fileName: string,
    excludedSheets: string[] = [],
    questionColumn?: string,
    questionColumnMap?: Record<string, string>
  ): Promise<StructuredUploadResult> {
    if (fileName.endsWith('.csv')) {
      return this.parseCSV(buffer, excludedSheets, questionColumn, questionColumnMap);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.parseExcel(buffer, excludedSheets, questionColumn, questionColumnMap);
    } else {
      throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
    }
  }

  /**
   * Simple row-by-row parsing for wizard uploads: one cluster per sheet
   * Does NOT detect sections - treats each row as a question
   */
  static async parseFileForWizard(
    buffer: Buffer | ArrayBuffer,
    fileName: string,
    excludedSheets: string[] = [],
    questionColumnMap?: Record<string, string>,
    selectedRowsBySheet?: Record<string, number[]>
  ): Promise<StructuredUploadResult> {
    if (fileName.endsWith('.csv')) {
      return this.parseCSVForWizard(buffer, excludedSheets, questionColumnMap, selectedRowsBySheet);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.parseExcelForWizard(buffer, excludedSheets, questionColumnMap, selectedRowsBySheet);
    } else {
      throw new Error('Unsupported file format. Please upload a CSV or Excel file.');
    }
  }

  /**
   * Parse Excel file with structure detection
   */
  private static async parseExcel(
    buffer: Buffer | ArrayBuffer,
    excludedSheets: string[] = [],
    questionColumn?: string,
    questionColumnMap?: Record<string, string>
  ): Promise<StructuredUploadResult> {
    const workbook = new ExcelJS.Workbook();
    const bufferToLoad = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bufferToLoad as any);

    const clusters: ClusterConfig[] = [];
    const allQuestions: ParsedQuestion[] = [];
    const sheetsDetected: string[] = [];
    let totalQuestions = 0;

    // Process each sheet as a tab cluster
    for (const worksheet of workbook.worksheets) {
      // Skip excluded sheets
      if (excludedSheets.includes(worksheet.name)) {
        continue;
      }

      sheetsDetected.push(worksheet.name);

      const tabClusterId = `tab_${worksheet.name}`;
      const tabCluster: ClusterConfig = {
        type: 'tab',
        title: worksheet.name,
        level: 0,
        order: clusters.length,
        questions: [],
      };

      // Find the header row (first row with 3+ non-empty cells)
      let headerRowNumber = 1;
      let rawHeaderValues: unknown[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rawHeaderValues.length === 0) {
          const values = (row.values as unknown[]).slice(1);
          const nonEmptyCount = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
          if (nonEmptyCount >= 3) {
            headerRowNumber = rowNumber;
            // Trim trailing empty columns to avoid "Column 1", "Column 2" noise
            let lastNonEmptyIndex = values.length - 1;
            while (lastNonEmptyIndex >= 0 && (values[lastNonEmptyIndex] === null || values[lastNonEmptyIndex] === undefined || String(values[lastNonEmptyIndex]).trim() === '')) {
              lastNonEmptyIndex--;
            }
            rawHeaderValues = values.slice(0, Math.max(3, lastNonEmptyIndex + 1));
          }
        }
      });

      // Build headers and deduplicate to ensure unique column names
      const rawHeaders = rawHeaderValues.map((value, index) => this.normalizeHeaderValue(value, index));
      const headers = deduplicateHeaders(rawHeaders);

      let questionColIndex = -1;
      let contextColIndex = -1;
      let categoryColIndex = -1;

      // Question column must be provided by client (auto-detection happens in UI)
      const perSheetColumn = questionColumnMap?.[worksheet.name];
      const normalizedQuestionColumn = (perSheetColumn || questionColumn)?.trim().toLowerCase();

      if (!normalizedQuestionColumn) {
        throw new Error(`No question column specified for sheet "${worksheet.name}"`);
      }

      headers.forEach((header, index) => {
        const headerText = header.toLowerCase();

        if (headerText === normalizedQuestionColumn) {
          questionColIndex = index;
        }

        if (
          headerText.includes('context') ||
          headerText.includes('background') ||
          headerText.includes('note') ||
          headerText.includes('description')
        ) {
          contextColIndex = index;
        }

        if (
          headerText.includes('category') ||
          headerText.includes('section') ||
          headerText.includes('type')
        ) {
          categoryColIndex = index;
        }
      });

      if (questionColIndex === -1) {
        throw new Error(
          `Question column "${perSheetColumn || questionColumn}" not found in sheet "${worksheet.name}"`
        );
      }

      // Track current section for clustering
      let currentSection: ClusterConfig | undefined;

      // Process data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return; // Skip header and rows before it

        const questionCell = row.getCell(questionColIndex + 1);
        const question = this.cellValueToString(questionCell.value).trim();

        // Skip empty rows
        if (!question) return;

        // Extract context if available
        let context: string | undefined;
        if (contextColIndex !== -1) {
          const contextCell = row.getCell(contextColIndex + 1);
          context = this.cellValueToString(contextCell.value).trim() || undefined;
        }

        // Extract category if available
        let category: string | undefined;
        if (categoryColIndex !== -1) {
          const categoryCell = row.getCell(categoryColIndex + 1);
          category = this.cellValueToString(categoryCell.value).trim() || undefined;
        }

        // Check if this row is a section header
        const { isSection, depth } = SectionDetector.isSectionNumbering(question);

        if (isSection) {
          // Create a new section cluster
          currentSection = {
            type: 'section',
            title: question,
            level: depth,
            order: tabCluster.questions.length,
            parent: tabClusterId,
            description: category,
            questions: [],
          };
          clusters.push(currentSection);
        } else {
          // This is a question row
          const parsedQuestion: ParsedQuestion = {
            question,
            context,
            category: category || currentSection?.category,
            originalRowIndex: rowNumber,
          };

          // Add to current section or tab
          if (currentSection) {
            currentSection.questions.push(parsedQuestion);
          } else {
            tabCluster.questions.push(parsedQuestion);
          }

          allQuestions.push(parsedQuestion);
          totalQuestions++;
        }
      });

      // Only add tab cluster if it has questions
      if (tabCluster.questions.length > 0 || clusters.some(c => c.parent === tabClusterId)) {
        clusters.push(tabCluster);
      }
    }

    // If no structure detected, create a default cluster with all questions
    if (clusters.length === 0 && allQuestions.length > 0) {
      clusters.push({
        type: 'default',
        title: 'All Questions',
        level: 0,
        order: 0,
        questions: allQuestions,
      });
    }

    return {
      clusters,
      metadata: {
        totalQuestions,
        sheetsDetected,
        sectionsDetected: clusters.filter(c => c.type === 'section').length,
        hasStructure: sheetsDetected.length > 1 || clusters.some(c => c.type === 'section'),
      },
    };
  }

  /**
   * Parse CSV file with category column support
   */
  private static async parseCSV(
    buffer: Buffer | ArrayBuffer,
    _excludedSheets?: string[],
    questionColumn?: string,
    questionColumnMap?: Record<string, string>
  ): Promise<StructuredUploadResult> {
    return new Promise((resolve, reject) => {
      const text =
        buffer instanceof ArrayBuffer ? new TextDecoder().decode(buffer) : buffer.toString();

      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        complete(results) {
          if (!results.data || results.data.length === 0) {
            reject(new Error('No data found in CSV'));
            return;
          }

          const headerKeys = Object.keys(results.data[0] || {});
          if (headerKeys.length === 0) {
            reject(new Error('CSV has no columns'));
            return;
          }

          // Find question column (first column by default)
          const mapColumn = questionColumnMap ? Object.values(questionColumnMap)[0] : undefined;
          let questionKey = headerKeys[0];
          if (questionColumn || mapColumn) {
            const normalizedQuestionColumn = (mapColumn || questionColumn)!.trim().toLowerCase();
            const match = headerKeys.find((key) => key.toLowerCase() === normalizedQuestionColumn);
            if (!match) {
              reject(new Error(`Question column "${mapColumn || questionColumn}" not found in CSV headers`));
              return;
            }
            questionKey = match;
          }

          // Look for category/section column
          let categoryKey: string | undefined;
          const categoryPatterns = ['category', 'section', 'type', 'group'];
          for (const pattern of categoryPatterns) {
            const found = headerKeys.find(k => k.toLowerCase().includes(pattern));
            if (found) {
              categoryKey = found;
              break;
            }
          }

          // Group questions by category if available
          const clusters: ClusterConfig[] = [];
          const categoryMap = new Map<string, ParsedQuestion[]>();
          const defaultQuestions: ParsedQuestion[] = [];
          let totalQuestions = 0;

          results.data.forEach((row, index) => {
            const questionText = row[questionKey]?.trim();
            if (!questionText) return;

            const parsed: ParsedQuestion = {
              question: questionText,
              originalRowIndex: index + 2, // +2 to account for header and 1-based indexing
            };

            // Extract category if available
            if (categoryKey && row[categoryKey]) {
              const categoryName = row[categoryKey].trim();
              parsed.category = categoryName;

              if (!categoryMap.has(categoryName)) {
                categoryMap.set(categoryName, []);
              }
              categoryMap.get(categoryName)!.push(parsed);
            } else {
              defaultQuestions.push(parsed);
            }

            totalQuestions++;
          });

          // Build clusters
          if (categoryMap.size > 0) {
            // Create section clusters for each category
            let order = 0;
            for (const [categoryName, questions] of categoryMap) {
              clusters.push({
                type: 'section',
                title: categoryName,
                level: 1,
                order: order++,
                category: categoryName,
                questions,
              });
            }

            // Add default cluster if there are uncategorized questions
            if (defaultQuestions.length > 0) {
              clusters.push({
                type: 'section',
                title: 'Uncategorized',
                level: 1,
                order: order,
                questions: defaultQuestions,
              });
            }
          } else {
            // No categories, create single cluster
            clusters.push({
              type: 'default',
              title: 'All Questions',
              level: 0,
              order: 0,
              questions: defaultQuestions,
            });
          }

          resolve({
            clusters,
            metadata: {
              totalQuestions,
              sheetsDetected: ['Sheet1'],
              sectionsDetected: categoryMap.size,
              hasStructure: categoryMap.size > 0,
            },
          });
        },
        error(error: unknown) {
          reject(error);
        },
      });
    });
  }

  /**
   * Parse Excel for wizard: one cluster per sheet, all rows as questions
   */
  private static async parseExcelForWizard(
    buffer: Buffer | ArrayBuffer,
    excludedSheets: string[] = [],
    questionColumnMap?: Record<string, string>,
    selectedRowsBySheet?: Record<string, number[]>
  ): Promise<StructuredUploadResult> {
    const workbook = new ExcelJS.Workbook();
    const bufferToLoad = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bufferToLoad as any);

    const clusters: ClusterConfig[] = [];
    let totalQuestions = 0;
    const sheetsDetected: string[] = [];

    // Process each sheet as a single cluster
    for (const worksheet of workbook.worksheets) {
      // Skip excluded sheets
      if (excludedSheets.includes(worksheet.name)) {
        continue;
      }

      sheetsDetected.push(worksheet.name);

      // Get question column for this sheet
      const questionColumn = questionColumnMap?.[worksheet.name];
      if (!questionColumn) {
        throw new Error(`No question column specified for sheet "${worksheet.name}"`);
      }

      // Convert column letter to 0-based index (A -> 0, B -> 1, etc.)
      const questionColIndex = columnLetterToIndex(questionColumn);

      // Extract all rows
      const rawRows: unknown[][] = [];
      worksheet.eachRow((row) => {
        const values = (row.values as unknown[]).slice(1);
        rawRows.push(values);
      });

      if (rawRows.length === 0) {
        continue; // Skip empty sheets
      }

      // Extract questions from all rows (no header detection)
      const sheetQuestions: ParsedQuestion[] = [];
      const selectedIndices = selectedRowsBySheet?.[worksheet.name];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const questionText = this.cellValueToString(row[questionColIndex]).trim();

        // Skip empty rows
        if (!questionText) {
          continue;
        }

        // If selectedRowsBySheet is provided, only include rows that are selected
        if (selectedIndices && !selectedIndices.includes(i)) {
          continue;
        }

        sheetQuestions.push({
          question: questionText,
          originalRowIndex: i + 1, // 1-based row number
        });

        totalQuestions++;
      }

      // Create cluster for this sheet
      if (sheetQuestions.length > 0) {
        clusters.push({
          type: 'tab',
          title: worksheet.name,
          level: 0,
          order: clusters.length,
          questions: sheetQuestions,
        });
      }
    }

    return {
      clusters,
      metadata: {
        totalQuestions,
        sheetsDetected,
        sectionsDetected: 0,
        hasStructure: sheetsDetected.length > 1,
      },
    };
  }

  /**
   * Parse CSV for wizard: treat as single cluster, all rows as questions
   */
  private static async parseCSVForWizard(
    buffer: Buffer | ArrayBuffer,
    _excludedSheets?: string[],
    questionColumnMap?: Record<string, string>,
    selectedRowsBySheet?: Record<string, number[]>
  ): Promise<StructuredUploadResult> {
    return new Promise((resolve, reject) => {
      const text =
        buffer instanceof ArrayBuffer ? new TextDecoder().decode(buffer) : buffer.toString();

      // Parse without headers - use array access by column letter
      Papa.parse<string[]>(text, {
        header: false,
        skipEmptyLines: true,
        complete(results) {
          if (!results.data || results.data.length === 0) {
            reject(new Error('No data found in CSV'));
            return;
          }

          // Get question column letter from map
          const mapColumn = questionColumnMap ? Object.values(questionColumnMap)[0] : undefined;
          if (!mapColumn) {
            reject(new Error('No question column specified for CSV'));
            return;
          }

          // Convert column letter to 0-based index
          const questionColIndex = columnLetterToIndex(mapColumn);

          // Extract all questions
          const questions: ParsedQuestion[] = [];
          let totalQuestions = 0;

          // For CSV, the sheet name is typically the filename without extension
          const csvSheetName = Object.keys(questionColumnMap || {})[0] || 'CSV';
          const selectedIndices = selectedRowsBySheet?.[csvSheetName];

          results.data.forEach((row, index) => {
            const questionText = (row[questionColIndex] || '').trim();
            if (!questionText) return;

            // If selectedRowsBySheet is provided, only include selected rows
            if (selectedIndices && !selectedIndices.includes(index)) {
              return;
            }

            questions.push({
              question: questionText,
              originalRowIndex: index + 1, // 1-based row number
            });

            totalQuestions++;
          });

          if (questions.length === 0) {
            reject(new Error('No questions found in CSV'));
            return;
          }

          resolve({
            clusters: [
              {
                type: 'default',
                title: 'Questions',
                level: 0,
                order: 0,
                questions,
              },
            ],
            metadata: {
              totalQuestions,
              sheetsDetected: ['CSV'],
              sectionsDetected: 0,
              hasStructure: false,
            },
          });
        },
        error(error: unknown) {
          reject(error);
        },
      });
    });
  }
}
