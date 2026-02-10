'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Check,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface ProjectHeaderProps {
  projectId: string;
  projectName: string;
  projectStatus: string;
  completedCount: number;
  rowCount: number;
  progressPercent: number;

  // Actions
  onSaveProject: () => void;
  onExportCSV: () => void;
  onFinalize: (action: 'finalize' | 'unfinalize') => void;
  onDelete: () => void;
  onGenerateAnswers?: () => void;

  // Loading states
  isSavingProject: boolean;
  hasUnansweredQuestions?: boolean;
  skillsLoaded?: boolean;
  isLoadingSkills?: boolean;
}

export function ProjectHeader({
  projectName,
  projectStatus,
  completedCount,
  rowCount,
  progressPercent,
  onSaveProject,
  onExportCSV,
  onFinalize,
  onDelete,
  onGenerateAnswers,
  isSavingProject,
  hasUnansweredQuestions = false,
  skillsLoaded = false,
  isLoadingSkills = false,
}: ProjectHeaderProps) {
  return (
    <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/v2/rfps/projects"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{projectName}</h1>
            <p className="text-sm text-slate-600">
              {completedCount} of {rowCount} processed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnansweredQuestions && onGenerateAnswers && (
            <button
              onClick={onGenerateAnswers}
              disabled={isLoadingSkills}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md font-medium"
              title={skillsLoaded ? "Start processing with selected skills" : "Load skill recommendations"}
            >
              {isLoadingSkills ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Loading Skills...
                </>
              ) : skillsLoaded ? (
                <>
                  <Sparkles size={16} />
                  Start Processing
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Answers
                </>
              )}
            </button>
          )}
          <button
            onClick={onSaveProject}
            disabled={isSavingProject}
            className="inline-flex items-center gap-2 px-3 py-2 border border-green-300 text-green-700 rounded-md hover:bg-green-50 disabled:opacity-50"
            title="Save all pending changes"
          >
            {isSavingProject ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save
              </>
            )}
          </button>
          <button
            onClick={onExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          {projectStatus === 'FINALIZED' ? (
            <button
              onClick={() => onFinalize('unfinalize')}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Reopen
            </button>
          ) : (
            <button
              onClick={() => onFinalize('finalize')}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
            >
              <ShieldCheck size={16} />
              Finalize
            </button>
          )}
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-md"
            title="Delete this project"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

    </div>
  );
}
