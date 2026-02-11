'use client';

/**
 * LLM Trace Tab
 *
 * Displays the full LLM trace for skill generation/refresh:
 * - System prompt
 * - User prompt
 * - Raw LLM response
 * - Metadata (model, tokens, composition, timestamp)
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { SkillCreationOutput } from '@/lib/v2/prompts/types';

// Use the canonical transparency type from the types definition
type LLMTrace = NonNullable<SkillCreationOutput['transparency']>;

interface LLMTraceTabProps {
  trace?: LLMTrace;
}

interface TraceSection {
  id: string;
  title: string;
  content: string;
}

export function LLMTraceTab({ trace }: LLMTraceTabProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['metadata', 'system'])
  );
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!trace) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-600">No LLM trace data available for this skill.</p>
        <p className="text-xs text-gray-500 mt-2">
          Skills created or refreshed after this feature was added will show trace data here.
        </p>
      </div>
    );
  }

  const sections: TraceSection[] = [
    {
      id: 'system',
      title: 'System Prompt',
      content: trace.systemPrompt,
    },
    {
      id: 'user',
      title: 'User Prompt',
      content: trace.userPrompt,
    },
    {
      id: 'response',
      title: 'Raw Response',
      content: trace.rawResponse,
    },
  ];

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopiedSection(null);
        timeoutRef.current = null;
      }, 1500);
    } catch {
      // Ignore copy errors
    }
  };

  const isExpanded = (id: string) => expandedSections.has(id);

  return (
    <div className="space-y-4">
      {/* Metadata Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Metadata</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase">Model</p>
            <p className="font-mono text-gray-900">{trace.model || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Timestamp</p>
            <p className="font-mono text-gray-900">
              {trace.timestamp
                ? new Date(trace.timestamp).toLocaleString()
                : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Input Tokens</p>
            <p className="font-mono text-gray-900">
              {trace.tokens?.input?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase">Output Tokens</p>
            <p className="font-mono text-gray-900">
              {trace.tokens?.output?.toLocaleString() || 'N/A'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 text-xs uppercase">Composition</p>
            <p className="font-mono text-gray-900">{trace.compositionId}</p>
          </div>
          <div className="col-span-2">
            <p className="text-gray-500 text-xs uppercase">Blocks</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {trace.blockIds && trace.blockIds.length > 0 ? (
                trace.blockIds.map((blockId) => (
                  <span
                    key={blockId}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                  >
                    {blockId}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">No blocks</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Sections */}
      {sections.map((section) => (
        <div
          key={section.id}
          className="bg-white rounded-lg border border-gray-200 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <h3 className="font-semibold text-sm">{section.title}</h3>
              <p className="text-xs text-gray-500 mt-1">
                {section.content.length.toLocaleString()} characters
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy(section.content, section.id)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Copy"
              >
                {copiedSection === section.id ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => toggleSection(section.id)}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title={isExpanded(section.id) ? 'Collapse' : 'Expand'}
              >
                {isExpanded(section.id) ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {isExpanded(section.id) && (
            <div className="p-4 overflow-auto max-h-96 bg-gray-50">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words text-gray-700 leading-relaxed">
                {section.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
