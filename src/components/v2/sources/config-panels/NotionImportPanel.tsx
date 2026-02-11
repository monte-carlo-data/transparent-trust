'use client';

/**
 * Notion Import Configuration Panel
 * Extracted from NotionSourceWizard - handles Notion page URL import
 */

import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LibraryId } from '@/types/v2';

interface NotionImportPanelProps {
  libraryId: LibraryId;
  showByDefault: boolean;
  onImportSuccess: () => Promise<void>;
}

export function NotionImportPanel({ libraryId, showByDefault, onImportSuccess }: NotionImportPanelProps) {
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isOpen, setIsOpen] = useState(showByDefault);

  const handleImportByUrl = async () => {
    if (!importUrl.trim()) return;

    setIsImporting(true);
    try {
      const response = await fetch('/api/v2/sources/import-notion-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importUrl,
          libraryId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import Notion page');
      }

      await response.json();
      toast.success('Notion page imported successfully');
      setImportUrl('');
      setIsOpen(false);

      // Refresh sources
      await onImportSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import Notion page';
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-3">Import from Notion</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste a Notion page URL..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleImportByUrl();
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleImportByUrl}
              disabled={!importUrl.trim() || isImporting}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import'
              )}
            </button>
            {!showByDefault && (
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 text-gray-700 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Show button to reopen panel when closed */}
      {!isOpen && !showByDefault && (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Import More Pages
        </button>
      )}
    </>
  );
}
