'use client';

import { cn } from '@/lib/utils';

export interface SheetData {
  name: string;
  columns: string[];
  rows: string[][];
}

interface SheetSelectorProps {
  sheets: SheetData[];
  selectedSheets: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable component for selecting sheets from a multi-sheet file.
 * Shows sheet name with row count and checkbox for selection.
 */
export function SheetSelector({
  sheets,
  selectedSheets,
  onSelectionChange,
  disabled = false,
  className,
}: SheetSelectorProps) {
  const toggleSheet = (sheetName: string) => {
    if (disabled) return;
    const newSelection = new Set(selectedSheets);
    if (newSelection.has(sheetName)) {
      newSelection.delete(sheetName);
    } else {
      newSelection.add(sheetName);
    }
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    if (disabled) return;
    onSelectionChange(new Set(sheets.map((s) => s.name)));
  };

  const clearAll = () => {
    if (disabled) return;
    onSelectionChange(new Set());
  };

  if (sheets.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Select Sheets
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            disabled={disabled}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
          >
            Select All
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sheets.map((sheet) => {
          const isSelected = selectedSheets.has(sheet.name);
          const rowCount = sheet.rows.length;

          return (
            <div
              key={sheet.name}
              onClick={() => toggleSheet(sheet.name)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSheet(sheet.name)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {sheet.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {rowCount} {rowCount === 1 ? 'row' : 'rows'} · {sheet.columns.length} columns
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSheets.size > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {selectedSheets.size} of {sheets.length} sheets selected
        </div>
      )}
    </div>
  );
}
