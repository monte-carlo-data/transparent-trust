'use client';

import Image from 'next/image';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkillOwner {
  userId?: string;
  name: string;
  email?: string;
  image?: string;
}

interface OwnerAvatarsProps {
  owners?: SkillOwner[];
  maxDisplay?: number;
  className?: string;
  size?: 'sm' | 'md';
}

export default function OwnerAvatars({
  owners = [],
  maxDisplay = 3,
  className,
  size = 'md',
}: OwnerAvatarsProps) {
  if (!owners || owners.length === 0) return null;

  const displayOwners = owners.slice(0, maxDisplay);
  const remainingCount = Math.max(0, owners.length - maxDisplay);

  const avatarSize = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  const negativeMargin = size === 'sm' ? '-ml-2' : '-ml-3';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-cyan-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center -space-x-3">
        {displayOwners.map((owner) => (
          <div
            key={owner.userId || owner.email || owner.name}
            title={`${owner.name}${owner.email ? ` (${owner.email})` : ''}`}
            className={cn(
              'flex items-center justify-center rounded-full text-white font-semibold border-2 border-white',
              avatarSize,
              getAvatarColor(owner.name)
            )}
          >
            {owner.image ? (
              <Image
                src={owner.image}
                alt={owner.name}
                fill
                className="rounded-full object-cover"
              />
            ) : (
              getInitials(owner.name)
            )}
          </div>
        ))}
        {remainingCount > 0 && (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-gray-300 text-gray-700 font-semibold border-2 border-white',
              avatarSize,
              negativeMargin
            )}
            title={`+${remainingCount} more owner${remainingCount !== 1 ? 's' : ''}`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      <Users className={cn('text-gray-500', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
    </div>
  );
}
