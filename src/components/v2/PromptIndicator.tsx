'use client';

/**
 * PromptIndicator Component
 *
 * Shows which prompt composition and persona are being used.
 * Allows users to see "behind the curtain" - no black boxes.
 */

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface PromptIndicatorProps {
  compositionName: string;
  compositionId: string;
  personaName?: string;
  personaId?: string;
  blocks?: string[];
  onChangePrompt?: () => void;
  compact?: boolean;
}

export function PromptIndicator({
  compositionName,
  personaName,
  blocks = [],
  onChangePrompt,
  compact = false,
}: PromptIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-gray-500">
        <span className="font-medium">🤖</span>
        <span>{compositionName}</span>
        {personaName && <span className="text-gray-400">· {personaName}</span>}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between hover:bg-blue-100 p-2 rounded transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="text-lg">🤖</div>
          <div>
            <p className="font-medium text-blue-900">
              Using: {compositionName}
            </p>
            {personaName && (
              <p className="text-xs text-blue-700">Persona: {personaName}</p>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-blue-600 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-blue-200 space-y-3">
          {blocks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-900 mb-2">Blocks Used:</p>
              <div className="flex flex-wrap gap-2">
                {blocks.map((block) => (
                  <span
                    key={block}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {block}
                  </span>
                ))}
              </div>
            </div>
          )}

          {onChangePrompt && (
            <button
              onClick={onChangePrompt}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 rounded transition-colors"
            >
              Change Prompt or Persona
            </button>
          )}

          <p className="text-xs text-blue-600 italic">
            This shows which prompt composition and persona were used to generate content.
            You can change them to regenerate with a different approach.
          </p>
        </div>
      )}
    </div>
  );
}
