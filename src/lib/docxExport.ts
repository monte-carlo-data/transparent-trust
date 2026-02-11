/**
 * DOCX Export Utility
 * Converts markdown content to DOCX format
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";

type MarkdownLine = {
  type: "h1" | "h2" | "h3" | "h4" | "paragraph" | "bullet" | "numbered" | "hr" | "table" | "code";
  content: string;
  level?: number; // For nested lists
  tableData?: string[][]; // For tables
};

/**
 * Parse markdown into structured lines
 */
function parseMarkdown(markdown: string): MarkdownLine[] {
  const lines = markdown.split("\n");
  const result: MarkdownLine[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block handling
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        result.push({ type: "code", content: codeContent.join("\n") });
        codeContent = [];
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // Table handling
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator rows (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }

      const cells = trimmed
        .slice(1, -1) // Remove leading and trailing |
        .split("|")
        .map((cell) => cell.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      // End of table
      result.push({ type: "table", content: "", tableData: tableRows });
      tableRows = [];
      inTable = false;
    }

    // Headers
    if (trimmed.startsWith("# ")) {
      result.push({ type: "h1", content: trimmed.slice(2) });
    } else if (trimmed.startsWith("## ")) {
      result.push({ type: "h2", content: trimmed.slice(3) });
    } else if (trimmed.startsWith("### ")) {
      result.push({ type: "h3", content: trimmed.slice(4) });
    } else if (trimmed.startsWith("#### ")) {
      result.push({ type: "h4", content: trimmed.slice(5) });
    }
    // Horizontal rule
    else if (/^[-*_]{3,}$/.test(trimmed)) {
      result.push({ type: "hr", content: "" });
    }
    // Bullet lists
    else if (/^[-*+]\s/.test(trimmed)) {
      const indent = line.search(/\S/);
      const level = Math.floor(indent / 2);
      result.push({
        type: "bullet",
        content: trimmed.replace(/^[-*+]\s+/, ""),
        level,
      });
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      const indent = line.search(/\S/);
      const level = Math.floor(indent / 2);
      result.push({
        type: "numbered",
        content: trimmed.replace(/^\d+\.\s+/, ""),
        level,
      });
    }
    // Regular paragraph (skip empty lines)
    else if (trimmed.length > 0) {
      result.push({ type: "paragraph", content: trimmed });
    }
  }

  // Handle table at end of content
  if (inTable && tableRows.length > 0) {
    result.push({ type: "table", content: "", tableData: tableRows });
  }

  // Handle code block at end of content
  if (inCodeBlock && codeContent.length > 0) {
    result.push({ type: "code", content: codeContent.join("\n") });
  }

  return result;
}

/**
 * Parse inline formatting (bold, italic, code) in text
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];

  // Regex to match bold (**text** or __text__), italic (*text* or _text_), and code (`text`)
  const regex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`(.+?)`/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.slice(lastIndex, match.index)));
    }

    if (match[2]) {
      // Bold
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[4]) {
      // Italic
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5]) {
      // Code
      runs.push(new TextRun({ text: match[5], font: "Courier New", shading: { fill: "E8E8E8" } }));
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun(text.slice(lastIndex)));
  }

  // If no formatting found, return single TextRun
  if (runs.length === 0) {
    runs.push(new TextRun(text));
  }

  return runs;
}

/**
 * Create a table from parsed data
 */
function createTable(tableData: string[][]): Table {
  const rows = tableData.map((rowData, rowIndex) => {
    const cells = rowData.map((cellText) =>
      new TableCell({
        children: [
          new Paragraph({
            children: parseInlineFormatting(cellText),
            alignment: AlignmentType.LEFT,
          }),
        ],
        width: { size: 100 / rowData.length, type: WidthType.PERCENTAGE },
        shading: rowIndex === 0 ? { fill: "E8E8E8" } : undefined,
      })
    );

    return new TableRow({ children: cells });
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Convert markdown content to DOCX Document
 */
export function markdownToDocx(
  markdown: string,
  options?: {
    title?: string;
    author?: string;
  }
): Document {
  const parsed = parseMarkdown(markdown);
  const children: (Paragraph | Table)[] = [];

  for (const line of parsed) {
    switch (line.type) {
      case "h1":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );
        break;

      case "h2":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          })
        );
        break;

      case "h3":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
        break;

      case "h4":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 200, after: 100 },
          })
        );
        break;

      case "bullet":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            bullet: { level: line.level || 0 },
            spacing: { before: 60, after: 60 },
          })
        );
        break;

      case "numbered":
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            numbering: { reference: "default-numbering", level: line.level || 0 },
            spacing: { before: 60, after: 60 },
          })
        );
        break;

      case "hr":
        children.push(
          new Paragraph({
            children: [],
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" },
            },
            spacing: { before: 200, after: 200 },
          })
        );
        break;

      case "table":
        if (line.tableData && line.tableData.length > 0) {
          children.push(createTable(line.tableData));
          children.push(new Paragraph({ children: [] })); // Spacing after table
        }
        break;

      case "code":
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.content,
                font: "Courier New",
                size: 20, // 10pt
              }),
            ],
            shading: { fill: "F5F5F5" },
            spacing: { before: 100, after: 100 },
          })
        );
        break;

      case "paragraph":
      default:
        children.push(
          new Paragraph({
            children: parseInlineFormatting(line.content),
            spacing: { before: 120, after: 120 },
          })
        );
        break;
    }
  }

  return new Document({
    creator: options?.author || "RFP Copilot",
    title: options?.title,
    description: "Generated by RFP Copilot",
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START },
            { level: 1, format: "lowerLetter", text: "%2.", alignment: AlignmentType.START },
            { level: 2, format: "lowerRoman", text: "%3.", alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        children,
      },
    ],
  });
}

/**
 * Convert markdown to DOCX buffer
 */
export async function markdownToDocxBuffer(
  markdown: string,
  options?: {
    title?: string;
    author?: string;
  }
): Promise<Buffer> {
  const doc = markdownToDocx(markdown, options);
  return await Packer.toBuffer(doc);
}

/**
 * Convert markdown to DOCX base64 string (for API response)
 */
export async function markdownToDocxBase64(
  markdown: string,
  options?: {
    title?: string;
    author?: string;
  }
): Promise<string> {
  const buffer = await markdownToDocxBuffer(markdown, options);
  return buffer.toString("base64");
}
