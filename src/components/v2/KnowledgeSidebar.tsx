'use client';

/**
 * Knowledge Sidebar Component for V2 Chat
 *
 * Displays selected knowledge context (skills, customers, documents)
 * for the current chat session
 */

import { BookOpen, Building2, X } from 'lucide-react';

export type KnowledgeContext = {
  type: 'skill' | 'customer' | 'document';
  id: string;
  title: string;
  library?: string;
};

interface KnowledgeSidebarProps {
  selectedContext: KnowledgeContext[];
  onRemoveContext: (id: string) => void;
  isLoading?: boolean;
}

const typeConfig = {
  skill: {
    icon: BookOpen,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  customer: {
    icon: Building2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  document: {
    icon: BookOpen,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

export function KnowledgeSidebar({
  selectedContext,
  onRemoveContext,
  isLoading = false,
}: KnowledgeSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-gray-50 border-l border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-700">
          Knowledge Context
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Selected knowledge for this conversation
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {selectedContext.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No knowledge selected</p>
            <p className="text-xs text-gray-400 mt-1">
              Select skills or customers from the dropdown above
            </p>
          </div>
        ) : (
          selectedContext.map((context) => {
            const config = typeConfig[context.type];
            const Icon = config.icon;

            return (
              <div
                key={context.id}
                className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <Icon className={`w-4 h-4 ${config.color} flex-shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {context.title}
                      </p>
                      {context.library && (
                        <p className="text-xs text-gray-600 mt-0.5 capitalize">
                          {context.library.replace('-', ' ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveContext(context.id)}
                    disabled={isLoading}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    aria-label={`Remove ${context.title}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-gray-200 bg-white text-xs text-gray-500">
        {selectedContext.length > 0 && (
          <p>{selectedContext.length} item{selectedContext.length !== 1 ? 's' : ''} selected</p>
        )}
      </div>
    </div>
  );
}
