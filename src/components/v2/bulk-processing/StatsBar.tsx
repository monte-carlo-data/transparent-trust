/**
 * StatsBar Component
 *
 * Displays metric cards in a grid layout.
 * Reusable across RFP processing and Contract analysis.
 */

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface StatConfig {
  label: string;
  value: number;
  colorClass?: string;
  icon?: ReactNode;
}

export interface StatsBarProps {
  stats: StatConfig[];
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((stat, i) => (
        <Card key={i} className="text-center">
          <CardContent className="py-4">
            <div className={cn('text-3xl font-bold', stat.colorClass || 'text-foreground')}>
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
              {stat.icon}
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
