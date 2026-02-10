'use client';

import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreshnessBadgeProps {
  lastVerifiedAt?: string;
  className?: string;
  size?: 'sm' | 'md';
}

function getDaysSinceVerified(dateString: string): number {
  const now = new Date();
  const verifiedDate = new Date(dateString);
  const diffMs = now.getTime() - verifiedDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getFreshnessStatus(days: number): {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
} {
  if (days === 0) {
    return {
      label: 'Updated today',
      icon: <CheckCircle className="w-4 h-4" />,
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
    };
  }
  if (days <= 7) {
    return {
      label: `${days}d ago`,
      icon: <Clock className="w-4 h-4" />,
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200',
    };
  }
  if (days <= 30) {
    return {
      label: `${Math.floor(days / 7)}w ago`,
      icon: <AlertCircle className="w-4 h-4" />,
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-200',
    };
  }
  return {
    label: `${Math.floor(days / 30)}mo ago`,
    icon: <AlertCircle className="w-4 h-4" />,
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  };
}

export default function FreshnessBadge({
  lastVerifiedAt,
  className,
  size = 'md',
}: FreshnessBadgeProps) {
  if (!lastVerifiedAt) return null;

  const days = getDaysSinceVerified(lastVerifiedAt);
  const status = getFreshnessStatus(days);

  const padding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 border rounded-full font-medium',
        status.bgColor,
        status.textColor,
        status.borderColor,
        padding,
        textSize,
        className
      )}
      title={`Last verified: ${new Date(lastVerifiedAt).toLocaleDateString()}`}
    >
      {status.icon}
      <span>{status.label}</span>
    </div>
  );
}
