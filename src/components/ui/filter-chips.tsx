'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

export interface FilterChipsProps<T extends string = string> {
  options: FilterOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  className?: string;
  showCounts?: boolean;
  allowClear?: boolean;
}

const colorStyles = {
  default: {
    active: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
    inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
  },
  green: {
    active: 'bg-green-600 text-white',
    inactive: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50',
  },
  yellow: {
    active: 'bg-yellow-500 text-white',
    inactive: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50',
  },
  red: {
    active: 'bg-red-600 text-white',
    inactive: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  },
  blue: {
    active: 'bg-blue-600 text-white',
    inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50',
  },
  gray: {
    active: 'bg-gray-600 text-white',
    inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
  },
};

export function FilterChips<T extends string = string>({
  options,
  value,
  onChange,
  className,
  showCounts = true,
  allowClear = true,
}: FilterChipsProps<T>) {
  const handleClick = (optionValue: T) => {
    if (value === optionValue && allowClear) {
      onChange(null);
    } else {
      onChange(optionValue);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const isActive = value === option.value;
        const color = option.color || 'default';
        const styles = colorStyles[color];

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              isActive ? styles.active : styles.inactive
            )}
          >
            {option.label}
            {showCounts && option.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold min-w-[18px] text-center',
                  isActive
                    ? 'bg-white/20'
                    : 'bg-black/10 dark:bg-white/10'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Pre-defined filter options for common use cases
export const confidenceFilterOptions: FilterOption<'high' | 'medium' | 'low'>[] = [
  { value: 'high', label: 'High', color: 'green' },
  { value: 'medium', label: 'Medium', color: 'yellow' },
  { value: 'low', label: 'Low', color: 'red' },
];

export const statusFilterOptions: FilterOption<'completed' | 'pending' | 'error'>[] = [
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'error', label: 'Error', color: 'red' },
];
