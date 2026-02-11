'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTokenCount } from '@/lib/tokenUtils';

interface TokenCountBadgeProps {
  /** Token count to display */
  tokens: number;
  /** Optional label override (default: "{tokens} tokens") */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS classes */
  className?: string;
  /** Optional title tooltip */
  title?: string;
}

/**
 * Neutral gray badge displaying token count.
 * Follows UsageBadge/PendingSourcesBadge pattern.
 */
export default function TokenCountBadge({
  tokens,
  label,
  size = 'md',
  className,
  title,
}: TokenCountBadgeProps) {
  if (tokens === 0) return null;

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  const displayLabel = label ?? `${formatTokenCount(tokens)} tokens`;
  const displayTitle = title ?? `Estimated ${tokens.toLocaleString()} tokens`;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 text-gray-700 font-medium',
        padding,
        textSize,
        className
      )}
      title={displayTitle}
    >
      <Zap className={iconSize} />
      <span>{displayLabel}</span>
    </div>
  );
}
