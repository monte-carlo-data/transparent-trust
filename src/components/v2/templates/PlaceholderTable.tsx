'use client';

/**
 * PlaceholderTable - Editable table for managing template placeholders
 *
 * Displays placeholders with inline-editable names and descriptions.
 * Supports add, delete, and bulk operations.
 */

import { Trash2, Plus, Wand2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface PlaceholderEntry {
  name: string;
  description: string;
}

interface PlaceholderTableProps {
  placeholders: PlaceholderEntry[];
  onChange: (placeholders: PlaceholderEntry[]) => void;
  onAutoDetect?: () => void;
  onBulkImport?: () => void;
  isAutoDetectLoading?: boolean;
  isAutoDetectDisabled?: boolean;
  autoDetectDisabledReason?: string;
}

export function PlaceholderTable({
  placeholders,
  onChange,
  onAutoDetect,
  onBulkImport,
  isAutoDetectLoading = false,
  isAutoDetectDisabled = false,
  autoDetectDisabledReason,
}: PlaceholderTableProps) {
  const handleAddPlaceholder = () => {
    onChange([...placeholders, { name: '', description: '' }]);
  };

  const handleDeletePlaceholder = (index: number) => {
    const updated = placeholders.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleNameChange = (index: number, name: string) => {
    const updated = [...placeholders];
    updated[index] = { ...updated[index], name };
    onChange(updated);
  };

  const handleDescriptionChange = (index: number, description: string) => {
    const updated = [...placeholders];
    updated[index] = { ...updated[index], description };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {onAutoDetect && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAutoDetect}
            disabled={isAutoDetectDisabled || isAutoDetectLoading}
            title={autoDetectDisabledReason}
          >
            <Wand2 className="h-4 w-4 mr-1" />
            {isAutoDetectLoading ? 'Detecting...' : 'Auto-detect from Slides'}
          </Button>
        )}
        {onBulkImport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBulkImport}
          >
            <Upload className="h-4 w-4 mr-1" />
            Bulk Import
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPlaceholder}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Placeholder
        </Button>
      </div>

      {/* Table */}
      {placeholders.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-md bg-gray-50">
          <p className="text-sm">No placeholders defined yet.</p>
          <p className="text-xs mt-1">
            Add placeholders manually or auto-detect from a Google Slides template.
          </p>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700 w-1/3">
                  Placeholder
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">
                  Description
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {placeholders.map((placeholder, index) => (
                <tr
                  key={index}
                  className="border-b last:border-b-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-mono text-xs">{'{{'}</span>
                      <Input
                        type="text"
                        value={placeholder.name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        placeholder="Name"
                        className="h-7 text-sm font-mono"
                      />
                      <span className="text-gray-400 font-mono text-xs">{'}}'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="text"
                      value={placeholder.description}
                      onChange={(e) => handleDescriptionChange(index, e.target.value)}
                      placeholder="What should this placeholder contain?"
                      className="h-7 text-sm"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePlaceholder(index)}
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {placeholders.length > 0 && (
        <p className="text-xs text-gray-500">
          {placeholders.length} placeholder{placeholders.length !== 1 ? 's' : ''} defined
        </p>
      )}
    </div>
  );
}
