'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryPillsProps {
  categories: string[];
  onRemove?: (category: string) => void;
  maxDisplay?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export default function CategoryPills({
  categories,
  onRemove,
  maxDisplay = 2,
  className,
  size = 'md',
}: CategoryPillsProps) {
  const displayCategories = categories.slice(0, maxDisplay);
  const remainingCount = Math.max(0, categories.length - maxDisplay);

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {displayCategories.map((category) => (
        <div
          key={category}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 whitespace-nowrap',
            padding,
            textSize
          )}
        >
          <span>{category}</span>
          {onRemove && (
            <button
              onClick={() => onRemove(category)}
              className="ml-1 text-blue-600 hover:text-blue-800 transition-colors"
              title="Remove category"
            >
              <X className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
            </button>
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className={cn('inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-700', padding, textSize)}>
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
