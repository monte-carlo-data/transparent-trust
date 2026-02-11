'use client';

/**
 * ScopeStep
 *
 * Wizard step for capturing skill scope definition.
 * Simplified to a single textarea with optional LLM assistance.
 */

import { Wand2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded?: string[];
}

interface ScopeStepProps {
  scope: ScopeDefinition;
  onScopeChange: (scope: ScopeDefinition) => void;
  onLLMAssist?: (coverageText: string) => Promise<string>;
}

export function ScopeStep({ scope, onScopeChange, onLLMAssist }: ScopeStepProps) {
  const [isLLMLoading, setIsLLMLoading] = useState(false);

  const handleCoversChange = (text: string) => {
    onScopeChange({ ...scope, covers: text });
  };

  const handleLLMAssist = async () => {
    if (!onLLMAssist) return;

    setIsLLMLoading(true);
    try {
      const enhanced = await onLLMAssist(scope.covers);
      onScopeChange({ ...scope, covers: enhanced });
    } catch (error) {
      console.error('LLM assist failed:', error);
    } finally {
      setIsLLMLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Define Scope</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Describe what this skill covers and its purpose. Be specific about topics and scenarios.
        </p>
      </div>

      {/* Scope Definition */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Scope Definition <span className="text-red-500">*</span>
          </label>
          {onLLMAssist && (
            <button
              onClick={handleLLMAssist}
              disabled={isLLMLoading || !scope.covers.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Wand2 className="w-3 h-3" />
              {isLLMLoading ? 'Enhancing...' : 'Enhance with AI'}
            </button>
          )}
        </div>
        <textarea
          value={scope.covers}
          onChange={(e) => handleCoversChange(e.target.value)}
          placeholder="e.g., Best practices for implementing authentication in Node.js applications, including JWT, OAuth2, and session-based approaches. Covers secure token storage, common vulnerabilities, and production considerations."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={8}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {scope.covers.length} characters
        </p>
      </div>

      {/* Info box */}
      <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900 dark:text-blue-100">
          This scope helps the team understand the skill&apos;s purpose. Be clear about what topics are covered, future additions, and what&apos;s explicitly out of scope.
        </p>
      </div>
    </div>
  );
}
