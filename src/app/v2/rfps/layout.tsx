/**
 * RFP Layout
 *
 * Server component that provides the header and tab navigation for all RFP pages.
 * Uses FeaturePageLayout for consistent structure.
 */

import { RFPTabNavigation } from './components/RFPTabNavigation';

interface RFPLayoutProps {
  children: React.ReactNode;
}

export default async function RFPLayout({ children }: RFPLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-slate-900">RFP & Questions</h1>
          <p className="text-slate-600 text-sm">
            Answer single questions or process bulk RFPs with AI-powered responses
          </p>
        </div>

        {/* Tab Navigation */}
        <RFPTabNavigation />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
