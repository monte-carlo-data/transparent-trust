'use client';

import { cn } from '@/lib/utils';
import type { SheetData } from './SheetSelector';

/** Convert 0-based index to column letter (0 -> A, 1 -> B, 26 -> AA) */
function indexToColumnLetter(index: number): string {
  let letter = '';
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

interface ColumnMappingSelectorProps {
  sheets: SheetData[];
  selectedSheets: Set<string>;
  columnMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
  /** Columns that were auto-detected (shown as placeholder hint) */
  detectedColumns?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  /** Label for what the column maps to (e.g., "Question Column") */
  label?: string;
}

/**
 * Reusable component for mapping columns in selected sheets.
 * Shows a dropdown per selected sheet to choose which column contains the target data.
 */
export function ColumnMappingSelector({
  sheets,
  selectedSheets,
  columnMapping,
  onMappingChange,
  detectedColumns = {},
  disabled = false,
  className,
  label = 'Question Column',
}: ColumnMappingSelectorProps) {
  const selectedSheetList = sheets.filter((s) => selectedSheets.has(s.name));

  if (selectedSheetList.length === 0) {
    return null;
  }

  const handleColumnChange = (sheetName: string, columnName: string) => {
    onMappingChange({
      ...columnMapping,
      [sheetName]: columnName,
    });
  };

  // Check if all selected sheets have a column mapped
  const allMapped = selectedSheetList.every((sheet) => columnMapping[sheet.name]);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </h3>
        {!allMapped && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Select a column for each sheet
          </span>
        )}
      </div>

      <div className="space-y-3">
        {selectedSheetList.map((sheet) => {
          const currentValue = columnMapping[sheet.name] || '';
          const detectedValue = detectedColumns[sheet.name];
          const placeholder = detectedValue
            ? `Detected: ${detectedValue}`
            : 'Select column...';

          return (
            <div
              key={sheet.name}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                'border-gray-200 dark:border-gray-700',
                disabled && 'opacity-50'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {sheet.name}
                </div>
              </div>
              <select
                value={currentValue}
                onChange={(e) => handleColumnChange(sheet.name, e.target.value)}
                disabled={disabled}
                className={cn(
                  'w-48 px-3 py-1.5 text-sm rounded-md border',
                  'border-gray-300 dark:border-gray-600',
                  'bg-white dark:bg-gray-800',
                  'text-gray-900 dark:text-white',
                  'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  !currentValue && 'text-gray-400'
                )}
              >
                <option value="">{placeholder}</option>
                {sheet.columns.map((col, index) => {
                  const letter = indexToColumnLetter(index);
                  return (
                    <option key={letter} value={letter}>
                      {letter}: {col}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
