'use client';

import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusBadgeV2Props {
  status?: 'synced' | 'pending' | 'failed' | null;
  lastSyncedAt?: string;
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  variant?: 'default' | 'icon-only';
}

function getSyncStatusConfig(status?: string | null) {
  switch (status) {
    case 'synced':
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Synced',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
      };
    case 'pending':
      return {
        icon: <Clock className="w-4 h-4" />,
        label: 'Pending',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
      };
    case 'failed':
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Failed',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
      };
    default:
      return null;
  }
}

export default function SyncStatusBadgeV2({
  status,
  lastSyncedAt,
  className,
  size = 'md',
  showLabel = true,
  variant = 'default',
}: SyncStatusBadgeV2Props) {
  const config = getSyncStatusConfig(status);
  if (!config) return null;

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  if (variant === 'icon-only') {
    return (
      <div
        className={cn(config.textColor, className)}
        title={`${config.label}${lastSyncedAt ? ` - ${new Date(lastSyncedAt).toLocaleDateString()}` : ''}`}
      >
        {config.icon}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        config.bgColor,
        config.textColor,
        config.borderColor,
        padding,
        textSize,
        className
      )}
      title={`${config.label}${lastSyncedAt ? ` - ${new Date(lastSyncedAt).toLocaleDateString()}` : ''}`}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
