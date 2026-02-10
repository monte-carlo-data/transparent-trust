'use client';

import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingSourcesBadgeProps {
  count: number;
  className?: string;
  size?: 'sm' | 'md';
}

export default function PendingSourcesBadge({
  count,
  className,
  size = 'md',
}: PendingSourcesBadgeProps) {
  if (!count || count === 0) return null;

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 text-amber-700 font-medium',
        padding,
        textSize,
        className
      )}
      title={`${count} pending source${count !== 1 ? 's' : ''} awaiting incorporation`}
    >
      <AlertCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{count} pending</span>
    </div>
  );
}
