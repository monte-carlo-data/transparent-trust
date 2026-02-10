/**
 * V2 Admin - Analysis Views Management
 *
 * Lists all code-defined customer analysis views.
 * Views are defined in code, not database (view-definitions.ts).
 */

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { getViewDefinitions } from '@/lib/v2/views';

export default function ViewsPage() {
  const views = getViewDefinitions();

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Analysis Views</h1>
        <p className="text-gray-600">
          Customer analysis views defined in code. These generate insights for customer profiles.
        </p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <BarChart3 className="w-4 h-4" />
            <span>{views.length} views defined</span>
          </div>
        </div>

        <div className="divide-y">
          {views.map((view) => (
            <div key={view.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{view.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{view.summary}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>ID: {view.id}</span>
                    <span>Composition: {view.compositionId}</span>
                    <span>Icon: {view.icon}</span>
                  </div>
                </div>
                <Link
                  href={`/v2/prompt-registry?search=${view.compositionId}`}
                  className="text-sm text-indigo-600 hover:text-indigo-700"
                >
                  View Prompt →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <strong>Note:</strong> Views are defined in code at{' '}
        <code className="bg-blue-100 px-1 rounded">src/lib/v2/views/view-definitions.ts</code>.
        To add or modify views, edit that file directly.
      </div>
    </div>
  );
}
