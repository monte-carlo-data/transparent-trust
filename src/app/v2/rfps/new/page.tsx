'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { Button } from '@/components/ui/button';
import { SheetSelector, type SheetData } from '@/components/v2/import/SheetSelector';
import { ColumnMappingSelector } from '@/components/v2/import/ColumnMappingSelector';

interface PreviewRow {
  sheetName: string;
  originalRowIndex: number;
  question: string;
  selected: boolean;
}

interface Customer {
  id: string;
  company: string;
  slug: string;
}

export default function NewRFPPage() {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<(SheetData & { headerRowIndex: number })[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [questionColumnMap, setQuestionColumnMap] = useState<Record<string, string>>({});
  const [detectedColumns, setDetectedColumns] = useState<Record<string, string>>({});
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryId, setLibraryId] = useState('knowledge');
  const [customerId, setCustomerId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  // Fetch customers on mount
  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch('/api/v2/customers');
        const json = await res.json();
        if (json.customers) {
          setCustomers(json.customers);
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setIsLoadingCustomers(false);
      }
    }
    fetchCustomers();
  }, []);

  // Deduplicate headers
  const deduplicateHeaders = useCallback((headers: string[]): string[] => {
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
  }, []);

  const buildSheetData = useCallback((rows: string[][], name: string): SheetData & { headerRowIndex: number } | null => {
    if (!rows.length) return null;

    let headerRowIndex = 0;
    for (let i = 0; i < rows.length; i++) {
      const nonEmptyCount = rows[i].filter((cell) => (cell ?? '').toString().trim().length > 0).length;
      if (nonEmptyCount >= 3) {
        headerRowIndex = i;
        break;
      }
    }

    const rawHeaders = rows[headerRowIndex] || [];
    const columns = deduplicateHeaders(rawHeaders.map((h) => (h ?? '').toString().trim() || 'Unnamed'));
    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => {
      const nonEmpty = row.filter((cell) => (cell ?? '').toString().trim().length > 0).length;
      return nonEmpty >= 2;
    });

    return { name, columns, rows: dataRows, headerRowIndex };
  }, [deduplicateHeaders]);

  const handleFileChange = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSheets([]);
    setSelectedSheets(new Set());
    setQuestionColumnMap({});
    setDetectedColumns({});

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();

      if (ext === 'csv') {
        const text = await selectedFile.text();
        Papa.parse(text, {
          complete: (results) => {
            const sheetData = buildSheetData(results.data as string[][], selectedFile.name.replace(/\.csv$/, ''));
            if (sheetData) {
              setSheets([sheetData]);
              setSelectedSheets(new Set([sheetData.name]));
            }
          },
          error: (err: Error) => {
            setError(`CSV parsing error: ${err.message}`);
          },
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const parsedSheets: (SheetData & { headerRowIndex: number })[] = [];
        workbook.eachSheet((worksheet) => {
          const rows: string[][] = [];
          worksheet.eachRow((row) => {
            // ExcelJS row.values is 1-indexed (index 0 is empty), slice to get 0-indexed array
            const values = row.values as string[];
            rows.push(values.slice(1));
          });
          const sheetData = buildSheetData(rows, worksheet.name);
          if (sheetData) {
            parsedSheets.push(sheetData);
          }
        });

        if (parsedSheets.length > 0) {
          setSheets(parsedSheets);
          setSelectedSheets(new Set(parsedSheets.map((s) => s.name)));
        } else {
          setError('No valid sheets found in the file');
        }
      } else {
        setError('Unsupported file type. Please upload CSV or Excel files.');
      }
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [buildSheetData]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  }, [handleFileChange]);

  // Convert column letter (A, B, ..., Z, AA, AB, ...) to 0-based index
  const columnLetterToIndex = useCallback((letter: string): number => {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
  }, []);

  // Build preview rows when sheets/columns change
  const buildPreviewRows = useCallback(() => {
    const newRows: PreviewRow[] = [];

    selectedSheets.forEach((sheetName) => {
      const sheet = sheets.find((s) => s.name === sheetName);
      const columnLetter = questionColumnMap[sheetName];

      if (sheet && columnLetter) {
        // Convert column letter (e.g., "A", "B", "C") to 0-based index
        const columnIndex = columnLetterToIndex(columnLetter);
        if (columnIndex >= 0 && columnIndex < sheet.columns.length) {
          sheet.rows.forEach((row, rowIndex) => {
            const questionText = row[columnIndex]?.toString().trim() ?? '';
            if (questionText) {
              // Calculate the 0-based row index matching the backend's rawRows array
              // rowIndex is 0-based within data rows (after header)
              // headerRowIndex is the 0-based index of the header row in rawRows
              // So the actual index in rawRows is: headerRowIndex + 1 (skip header) + rowIndex
              const rawRowsIndex = sheet.headerRowIndex + 1 + rowIndex;
              newRows.push({
                sheetName,
                originalRowIndex: rawRowsIndex,
                question: questionText,
                selected: true, // Default to selected
              });
            }
          });
        }
      }
    });

    setPreviewRows(newRows);
  }, [sheets, selectedSheets, questionColumnMap, columnLetterToIndex]);

  // Rebuild preview rows when column mapping changes
  useEffect(() => {
    buildPreviewRows();
  }, [buildPreviewRows]);

  const handleUpload = async () => {
    if (!file) return;

    // Validate that at least one question is selected
    const selectedRows = previewRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setError('Please select at least one question to upload');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const excludedSheets = sheets
        .filter((s) => !selectedSheets.has(s.name))
        .map((s) => s.name);

      if (excludedSheets.length > 0) {
        formData.append('excludedSheets', JSON.stringify(excludedSheets));
      }

      if (Object.keys(questionColumnMap).length > 0) {
        formData.append('questionColumnMap', JSON.stringify(questionColumnMap));
      }

      // Pass selected row indices per sheet
      const selectedRowsBySheet: Record<string, number[]> = {};
      selectedRows.forEach(row => {
        if (!selectedRowsBySheet[row.sheetName]) {
          selectedRowsBySheet[row.sheetName] = [];
        }
        selectedRowsBySheet[row.sheetName].push(row.originalRowIndex);
      });
      formData.append('selectedRowsBySheet', JSON.stringify(selectedRowsBySheet));

      // Pass libraryId for skill matching in approval phase
      formData.append('libraryId', libraryId);

      // Pass customerId if selected
      if (customerId) {
        formData.append('customerId', customerId);
      }

      const response = await fetch('/api/v2/projects/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Upload failed');
      }

      // Redirect to project detail page
      router.push(`/v2/rfps/${result.data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  // Validate that all selected sheets have a question column mapped
  const allSheetsMapped = Array.from(selectedSheets).every(
    (sheetName) => questionColumnMap[sheetName]
  );
  const hasSelectedRows = previewRows.some(r => r.selected);
  const canUpload = file && sheets.length > 0 && selectedSheets.size > 0 && allSheetsMapped && hasSelectedRows;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Upload RFP</h1>
          <p className="text-slate-600">
            Upload an Excel or CSV file with your RFP questions. We&apos;ll parse the questions and help you match them to your knowledge base.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Upload Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        {!file && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-white hover:border-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-700 mb-2">
              Drop your file here or click to browse
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Supports CSV, XLS, and XLSX files
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
              id="file-input"
            />
            <label htmlFor="file-input">
              <Button variant="outline" className="cursor-pointer" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </span>
              </Button>
            </label>
          </div>
        )}

        {/* Sheet Selection */}
        {file && sheets.length > 0 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Selected File</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setSheets([]);
                    setSelectedSheets(new Set());
                    setQuestionColumnMap({});
                  }}
                >
                  Change File
                </Button>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <FileSpreadsheet className="w-5 h-5" />
                <span>{file.name}</span>
                <span className="text-slate-400">•</span>
                <span>{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>

            <SheetSelector
              sheets={sheets}
              selectedSheets={selectedSheets}
              onSelectionChange={setSelectedSheets}
            />

            <ColumnMappingSelector
              sheets={sheets.filter((s) => selectedSheets.has(s.name))}
              selectedSheets={selectedSheets}
              columnMapping={questionColumnMap}
              onMappingChange={setQuestionColumnMap}
              detectedColumns={detectedColumns}
              label="Question Column"
            />

            {/* Question Preview */}
            {previewRows.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Question Preview ({previewRows.filter(r => r.selected).length} of {previewRows.length} selected)
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewRows(prev => prev.map(r => ({ ...r, selected: true })))}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewRows(prev => prev.map(r => ({ ...r, selected: false })))}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                {/* Group by sheet */}
                {Array.from(new Set(previewRows.map(r => r.sheetName))).map((sheetName) => {
                  const sheetRows = previewRows.filter(r => r.sheetName === sheetName);
                  const selectedCount = sheetRows.filter(r => r.selected).length;

                  return (
                    <div key={sheetName} className="space-y-2">
                      <div className="flex items-center justify-between py-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                          <h4 className="text-sm font-medium text-slate-900">{sheetName}</h4>
                          <span className="text-xs text-slate-500">
                            ({selectedCount} of {sheetRows.length} selected)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setPreviewRows(prev => prev.map(r =>
                                r.sheetName === sheetName ? { ...r, selected: true } : r
                              ));
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Select All
                          </button>
                          <button
                            onClick={() => {
                              setPreviewRows(prev => prev.map(r =>
                                r.sheetName === sheetName ? { ...r, selected: false } : r
                              ));
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {sheetRows.map((row) => (
                          <div
                            key={`${row.sheetName}-${row.originalRowIndex}`}
                            className="flex items-start gap-3 p-3 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => {
                                setPreviewRows(prev => prev.map(r =>
                                  r.sheetName === row.sheetName && r.originalRowIndex === row.originalRowIndex
                                    ? { ...r, selected: !r.selected }
                                    : r
                                ));
                              }}
                              className="mt-1 h-4 w-4 rounded border-slate-300"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900">{row.question}</p>
                              <p className="text-xs text-slate-500 mt-1">Row {row.originalRowIndex + 1}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customer Selection */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Customer (Optional)</h3>
              <p className="text-xs text-slate-600">
                Link this RFP to a customer profile to include their skills in matching.
              </p>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={isLoadingCustomers}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">No customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company}
                  </option>
                ))}
              </select>
            </div>

            {/* Knowledge Library Selection */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Knowledge Library</h3>
              <p className="text-xs text-slate-600">
                Select which skill library to use for matching questions.
              </p>
              <select
                value={libraryId}
                onChange={(e) => setLibraryId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="knowledge">General Knowledge</option>
                <option value="it">IT Skills</option>
                <option value="gtm">GTM Skills</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                disabled={!canUpload || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {previewRows.length > 0
                      ? `Upload ${previewRows.filter(r => r.selected).length} Questions`
                      : 'Upload & Continue'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/v2/rfps/projects')}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
