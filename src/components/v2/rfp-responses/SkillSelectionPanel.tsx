'use client';

/**
 * Skill Selection Panel for RFPs
 *
 * Inline collapsible panel for selecting skills before processing RFP questions.
 * Reusable across different RFP processing contexts.
 */

import { Loader2, ChevronUp } from 'lucide-react';
import type { SkillPreview } from '@/app/v2/rfps/[projectId]/types';
import { getConfidenceColor } from '@/lib/v2/ui-utils';

interface SkillSelectionPanelProps {
  isOpen: boolean;
  isLoading: boolean;
  isProcessing: boolean;
  skills: SkillPreview[];
  selectedSkillIds: Set<string>;
  batchSize: number;
  completedCount?: number;
  totalCount?: number;
  onToggleSkill: (skillId: string) => void;
  onBatchSizeChange: (size: number) => void;
  onClose: () => void;
}

export function SkillSelectionPanel({
  isOpen,
  isLoading,
  isProcessing,
  skills,
  selectedSkillIds,
  batchSize,
  completedCount = 0,
  totalCount = 0,
  onToggleSkill,
  onBatchSizeChange,
  onClose,
}: SkillSelectionPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Select Skills for Processing
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <ChevronUp size={20} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span className="text-gray-600 dark:text-gray-400">
            Loading skill recommendations...
          </span>
        </div>
      ) : isProcessing ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin mr-2" size={20} />
          <span className="text-gray-600 dark:text-gray-400">
            Processing {totalCount} questions... ({completedCount}/{totalCount} complete)
          </span>
        </div>
      ) : skills.length > 0 ? (
        <>
          {/* Skill List */}
          <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
            {/* Library Skills Section */}
            {skills.filter((s) => !s.isCustomerSkill).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Library Skills
                </h4>
                <div className="space-y-2">
                  {skills
                    .filter((skill) => !skill.isCustomerSkill)
                    .map((skill) => (
                      <label
                        key={skill.skillId}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSkillIds.has(skill.skillId)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillIds.has(skill.skillId)}
                          onChange={() => onToggleSkill(skill.skillId)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {skill.skillTitle}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(
                                skill.confidence
                              )}`}
                            >
                              {skill.confidence}
                            </span>
                          </div>
                          {skill.reason && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                              {skill.reason}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          ~{skill.estimatedTokens.toLocaleString()} tokens
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}

            {/* Customer Skills Section */}
            {skills.filter((s) => s.isCustomerSkill).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-2 flex items-center gap-2">
                  <span>Customer-Specific Skills</span>
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    ({skills.filter((s) => s.isCustomerSkill).length})
                  </span>
                </h4>
                <div className="space-y-2">
                  {skills
                    .filter((skill) => skill.isCustomerSkill)
                    .map((skill) => (
                      <label
                        key={skill.skillId}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSkillIds.has(skill.skillId)
                            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700'
                            : 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkillIds.has(skill.skillId)}
                          onChange={() => onToggleSkill(skill.skillId)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {skill.skillTitle}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(
                                skill.confidence
                              )}`}
                            >
                              {skill.confidence}
                            </span>
                          </div>
                          {skill.reason && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                              {skill.reason}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          ~{skill.estimatedTokens.toLocaleString()} tokens
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedSkillIds.size} of {skills.length} skills selected
              </span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Batch size:</label>
                <select
                  value={batchSize}
                  onChange={(e) => onBatchSizeChange(Number(e.target.value))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
