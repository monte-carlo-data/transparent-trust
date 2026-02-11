'use client';

/**
 * SourceItem Component
 *
 * Canonical component for displaying a source with its token cost.
 * Self-reports token cost to nearest TokenRegistryProvider when mounted.
 * Used consistently across RefreshDialog, SourceSelector, Sidebar, etc.
 */

import { FileText, Globe, MessageSquare, Phone, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import TokenCountBadge from '../tokens/TokenCountBadge';
import { useTokenCost } from '@/lib/v2/tokens/useTokenCost';

// Source type icon mapping
const SOURCE_ICONS: Record<string, typeof FileText> = {
  zendesk: MessageSquare,
  slack: MessageSquare,
  notion: FileText,
  gong: Phone,
  url: Globe,
  document: File,
};

export interface SourceItemData {
  id: string;
  title: string;
  sourceType: string;
  content?: string;
  contentLength?: number;
}

interface SourceItemProps {
  /** Source data */
  source: SourceItemData;
  /** Whether this source is selected (for checkbox display) */
  selected?: boolean;
  /** Callback when selection toggled */
  onToggle?: (id: string) => void;
  /** Whether to show checkbox */
  showCheckbox?: boolean;
  /** Whether to register token cost with registry (default: true) */
  registerTokens?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

export function SourceItem({
  source,
  selected,
  onToggle,
  showCheckbox = false,
  registerTokens = true,
  size = 'md',
  className,
}: SourceItemProps) {
  const Icon = SOURCE_ICONS[source.sourceType] || FileText;

  // Calculate token count from content
  const charCount = source.content?.length ?? source.contentLength ?? 0;
  const tokens = Math.ceil(charCount * 0.25); // ~4 chars per token

  // Self-report to token registry if enabled
  useTokenCost({
    id: source.id,
    label: source.title,
    type: 'source',
    charCount,
    enabled: registerTokens,
  });

  const content = (
    <div className={cn(
      'flex items-start gap-3 w-full',
      size === 'sm' ? 'py-2' : 'py-3',
      className
    )}>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle?.(source.id)}
          className="mt-1 cursor-pointer"
        />
      )}
      <Icon className={cn(
        'flex-shrink-0 text-gray-400',
        size === 'sm' ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'
      )} />
      <div className="flex-1 min-w-0">
        <div className={cn(
          'font-medium text-gray-900 truncate',
          size === 'sm' ? 'text-sm' : 'text-base'
        )}>
          {source.title}
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <span className={cn(
            'text-gray-500 capitalize',
            size === 'sm' ? 'text-xs' : 'text-sm'
          )}>
            {source.sourceType}
          </span>
          <TokenCountBadge tokens={tokens} size="sm" />
        </div>
      </div>
    </div>
  );

  // Wrap in label if checkbox is shown for better UX
  if (showCheckbox) {
    return (
      <label className="flex cursor-pointer hover:bg-gray-50 px-4 rounded-lg transition-colors">
        {content}
      </label>
    );
  }

  return <div className="px-4">{content}</div>;
}

export default SourceItem;
