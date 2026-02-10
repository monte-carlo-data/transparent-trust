'use client';

/**
 * BotPromptEditorSection Component
 *
 * Collapsible prompt editor for admin users.
 * Allows block-by-block editing of Slack bot prompts.
 * Part of the unified Slack Bot tab.
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Check, Loader2, Edit2 } from 'lucide-react';
import { slackBotCompositions } from '@/lib/v2/prompts/compositions/slack-bot-compositions';
import { getBlocks } from '@/lib/v2/prompts/blocks/core-blocks';
import { cn } from '@/lib/utils';

interface PromptBlock {
  id: string;
  name: string;
  content: string;
}

interface BotPromptEditorSectionProps {
  libraryId: 'knowledge' | 'it' | 'gtm' | 'talent';
  isAdmin: boolean;
}

/**
 * Load prompt blocks from composition
 */
function loadPromptBlocks(libraryId: 'knowledge' | 'it' | 'gtm' | 'talent'): PromptBlock[] {
  const compositionContext = `slack_bot_${libraryId}`;
  const composition = slackBotCompositions.find((c) => c.context === compositionContext);

  if (!composition) {
    return [];
  }

  const blocks = getBlocks(composition.blockIds);
  return blocks.map((block, index) => ({
    id: block.id,
    name: block.name || `Block ${index + 1}`,
    content: block.content,
  }));
}

export function BotPromptEditorSection({ libraryId, isAdmin }: BotPromptEditorSectionProps) {
  const [editExpanded, setEditExpanded] = useState(false);
  const [editingBlocks, setEditingBlocks] = useState<Record<string, string>>({});
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const promptBlocks = useMemo(() => loadPromptBlocks(libraryId), [libraryId]);

  // Don't render anything if user is not admin
  if (!isAdmin) {
    return null;
  }

  const initializeEditing = () => {
    const initial: Record<string, string> = {};
    promptBlocks.forEach((block) => {
      initial[block.id] = block.content;
    });
    setEditingBlocks(initial);
  };

  const handleStartEdit = () => {
    initializeEditing();
    setEditExpanded(true);
    setShowPreview(false);
  };

  const handleBlockChange = (blockId: string, newContent: string) => {
    setEditingBlocks((prev) => ({
      ...prev,
      [blockId]: newContent,
    }));
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const changedBlocks = promptBlocks.filter(
        (block) => editingBlocks[block.id] !== block.content
      );

      if (changedBlocks.length === 0) {
        setEditExpanded(false);
        setSaving(false);
        return;
      }

      const savePromises = changedBlocks.map((block) =>
        fetch(`/api/admin/prompts/${block.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editingBlocks[block.id],
            commitMessage: `Updated ${block.name} from ${libraryId} library Slack Bot tab`,
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to save block ${block.name}`);
          return res.json();
        })
      );

      await Promise.all(savePromises);

      setSaveSuccess(`Saved ${changedBlocks.length} block(s). Changes are live.`);
      setTimeout(() => setSaveSuccess(null), 3000);
      setEditExpanded(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => {
          if (!editExpanded) {
            handleStartEdit();
          } else {
            setEditExpanded(false);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Edit2 className="w-4 h-4 text-gray-600" />
          <span className="font-medium text-gray-900">Edit Bot Prompt</span>
        </div>
        {editExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {editExpanded && (
        <div className="p-4 space-y-4">
          {saveError && (
            <div className="flex gap-2 p-2 bg-red-50 rounded text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="flex gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{saveSuccess}</span>
            </div>
          )}

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {promptBlocks.map((block) => (
              <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200">
                  <h5 className="text-sm font-medium text-gray-900">{block.name}</h5>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {block.id}</p>
                </div>
                <textarea
                  value={editingBlocks[block.id] || block.content}
                  onChange={(e) => handleBlockChange(block.id, e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={4}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {showPreview && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-gray-700 mb-2">ASSEMBLED PROMPT:</p>
              <div className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                {promptBlocks.map((block) => editingBlocks[block.id] || block.content).join('\n\n')}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={handleSavePrompt}
              disabled={isSaving}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-medium transition-colors',
                isSaving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => setEditExpanded(false)}
              disabled={isSaving}
              className="flex-1 px-4 py-2 border border-gray-300 rounded font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Changes apply immediately to the bot for this library.
          </p>
        </div>
      )}
    </div>
  );
}
