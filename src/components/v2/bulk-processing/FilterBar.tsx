/**
 * FilterBar Component
 *
 * Generic filtering component with selects, toggles, and multi-selects.
 * Reusable across RFP processing and Contract analysis.
 */

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface Filter {
  key: string;
  label: string;
  type: 'select' | 'toggle' | 'multi-select';
  options?: FilterOption[];
  value: string | boolean | string[];
  onChange: (value: unknown) => void;
}

export interface FilterBarProps {
  filters: Filter[];
  resultCount: number;
  totalCount: number;
  onClearAll: () => void;
}

export function FilterBar({ filters, resultCount, totalCount, onClearAll }: FilterBarProps) {
  const hasActiveFilters = filters.some((f) => {
    if (typeof f.value === 'string' && f.value !== 'all') return true;
    if (typeof f.value === 'boolean' && f.value) return true;
    if (Array.isArray(f.value) && f.value.length > 0) return true;
    return false;
  });

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4">
      <span className="text-sm font-medium text-gray-700">Filters:</span>

      {filters.map((filter) => (
        <FilterControl key={filter.key} filter={filter} />
      ))}

      {hasActiveFilters && (
        <Button onClick={onClearAll} variant="ghost" size="sm" className="text-blue-600">
          Clear filters
        </Button>
      )}

      <span className="ml-auto text-sm text-gray-500">
        Showing {resultCount} of {totalCount}
      </span>
    </div>
  );
}

function FilterControl({ filter }: { filter: Filter }) {
  if (filter.type === 'select') {
    return (
      <Select value={filter.value as string} onValueChange={filter.onChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder={filter.label} />
        </SelectTrigger>
        <SelectContent>
          {filter.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
              {option.count !== undefined && ` (${option.count})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (filter.type === 'toggle') {
    return (
      <div className="flex items-center gap-2">
        <Switch
          id={filter.key}
          checked={filter.value as boolean}
          onCheckedChange={filter.onChange}
        />
        <Label htmlFor={filter.key} className="text-sm cursor-pointer">
          {filter.label}
        </Label>
      </div>
    );
  }

  // Multi-select not implemented yet - can add if needed
  return null;
}
