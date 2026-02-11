'use client';

/**
 * BulkImportModal - Import multiple placeholders from text
 *
 * Accepts format: {{Name}}[Description] per line
 * Shows a preview of parsed placeholders before import.
 */

import { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { PlaceholderEntry } from './PlaceholderTable';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (placeholders: PlaceholderEntry[]) => void;
}

interface ParsedLine {
  line: string;
  lineNumber: number;
  placeholder: PlaceholderEntry | null;
  error: string | null;
}

/**
 * Parse a single line in the format: {{Name}}[Description]
 * Also accepts: Name[Description] (without braces)
 */
function parseLine(line: string, lineNumber: number): ParsedLine {
  const trimmed = line.trim();

  if (!trimmed) {
    return { line, lineNumber, placeholder: null, error: null };
  }

  // Try to match {{Name}}[Description] format
  const bracesMatch = trimmed.match(/^\{\{([^}]+)\}\}\s*\[([^\]]*)\]$/);
  if (bracesMatch) {
    return {
      line,
      lineNumber,
      placeholder: { name: bracesMatch[1].trim(), description: bracesMatch[2].trim() },
      error: null,
    };
  }

  // Try to match Name[Description] format (without braces)
  const noBracesMatch = trimmed.match(/^([^[\]{}]+)\s*\[([^\]]*)\]$/);
  if (noBracesMatch) {
    return {
      line,
      lineNumber,
      placeholder: { name: noBracesMatch[1].trim(), description: noBracesMatch[2].trim() },
      error: null,
    };
  }

  // If line has content but doesn't match, it's an error
  return {
    line,
    lineNumber,
    placeholder: null,
    error: 'Invalid format. Expected: {{Name}}[Description] or Name[Description]',
  };
}

export function BulkImportModal({ isOpen, onClose, onImport }: BulkImportModalProps) {
  const [input, setInput] = useState('');

  const parsed = useMemo((): ParsedLine[] => {
    const lines = input.split('\n');
    return lines.map((line, index) => parseLine(line, index + 1));
  }, [input]);

  const validPlaceholders = parsed
    .filter((p) => p.placeholder !== null)
    .map((p) => p.placeholder!);

  const errors = parsed.filter((p) => p.error !== null);

  const handleImport = () => {
    if (validPlaceholders.length > 0) {
      onImport(validPlaceholders);
      setInput('');
      onClose();
    }
  };

  const handleClose = () => {
    setInput('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Placeholders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste placeholder definitions
            </label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`{{Customer}}[Company name]
{{Goal 1}}[Primary data initiative in 7 words or fewer]
{{Goal 1 D}}[Business context and driver in up to 50 words]`}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: <code className="bg-gray-100 px-1 rounded">{'{{Name}}[Description]'}</code> or{' '}
              <code className="bg-gray-100 px-1 rounded">Name[Description]</code>, one per line
            </p>
          </div>

          {/* Preview */}
          {input.trim() && (
            <div className="border rounded-md overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b">
                <span className="text-sm font-medium">Preview</span>
                {validPlaceholders.length > 0 && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({validPlaceholders.length} placeholder{validPlaceholders.length !== 1 ? 's' : ''} found)
                  </span>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {parsed.map((item, index) => {
                  // Skip empty lines in preview
                  if (!item.line.trim()) return null;

                  return (
                    <div
                      key={index}
                      className={`px-3 py-2 text-sm border-b last:border-b-0 flex items-start gap-2 ${
                        item.error ? 'bg-red-50' : 'bg-white'
                      }`}
                    >
                      {item.placeholder ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-mono text-xs text-gray-500">{'{{'}</span>
                            <span className="font-medium">{item.placeholder.name}</span>
                            <span className="font-mono text-xs text-gray-500">{'}}'}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="text-gray-600">{item.placeholder.description}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-red-700 font-mono text-xs truncate max-w-md">
                              Line {item.lineNumber}: {item.line.substring(0, 50)}
                              {item.line.length > 50 && '...'}
                            </div>
                            <div className="text-red-600 text-xs">{item.error}</div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Errors summary */}
          {errors.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
              {errors.length} line{errors.length !== 1 ? 's' : ''} could not be parsed and will be
              skipped.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={validPlaceholders.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Import {validPlaceholders.length > 0 ? `${validPlaceholders.length} ` : ''}Placeholder
            {validPlaceholders.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
