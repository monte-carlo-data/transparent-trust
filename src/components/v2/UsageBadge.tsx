'use client';

import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageBadgeProps {
  usageCount?: number;
  lastUsedAt?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export default function UsageBadge({
  usageCount = 0,
  lastUsedAt,
  className,
  size = 'md',
}: UsageBadgeProps) {
  if (!usageCount || usageCount === 0) return null;

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 text-green-700 font-medium',
        padding,
        textSize,
        className
      )}
      title={lastUsedAt ? `Used ${usageCount} times, last at ${new Date(lastUsedAt).toLocaleDateString()}` : `Used ${usageCount} times`}
    >
      <BarChart3 className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{usageCount}</span>
    </div>
  );
}
