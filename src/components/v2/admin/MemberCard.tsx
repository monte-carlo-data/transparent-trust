'use client';

/**
 * MemberCard Component
 *
 * Displays a team member with role selector and remove button.
 */

import Image from 'next/image';
import { useState } from 'react';
import { User, Trash2, ChevronDown, Shield, Eye, UserCheck } from 'lucide-react';

interface MemberCardProps {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'admin' | 'member' | 'viewer';
  isCurrentUser: boolean;
  canEdit: boolean;
  onRoleChange: (userId: string, newRole: 'admin' | 'member' | 'viewer') => void;
  onRemove: (userId: string) => void;
}

const roleConfig = {
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'text-purple-700 bg-purple-100',
    description: 'Full access to team settings and members',
  },
  member: {
    label: 'Member',
    icon: UserCheck,
    color: 'text-blue-700 bg-blue-100',
    description: 'Can manage content in team libraries',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'text-gray-700 bg-gray-100',
    description: 'Read-only access to team content',
  },
};

export function MemberCard({
  userId,
  name,
  email,
  image,
  role,
  isCurrentUser,
  canEdit,
  onRoleChange,
  onRemove,
}: MemberCardProps) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const currentRole = roleConfig[role];
  const RoleIcon = currentRole.icon;

  const handleRoleSelect = (newRole: 'admin' | 'member' | 'viewer') => {
    onRoleChange(userId, newRole);
    setShowRoleMenu(false);
  };

  const handleRemove = () => {
    onRemove(userId);
    setShowRemoveConfirm(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {image ? (
            <Image src={image} alt="" width={40} height={40} className="rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {name || 'No name'}
            </p>
            {isCurrentUser && (
              <span className="text-xs text-gray-500">(you)</span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>

        {/* Role Selector */}
        <div className="relative">
          <button
            onClick={() => canEdit && setShowRoleMenu(!showRoleMenu)}
            disabled={!canEdit}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${currentRole.color} ${
              canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
            }`}
          >
            <RoleIcon className="w-3 h-3" />
            {currentRole.label}
            {canEdit && <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Role Dropdown */}
          {showRoleMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowRoleMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                {(Object.keys(roleConfig) as Array<keyof typeof roleConfig>).map(
                  (roleKey) => {
                    const config = roleConfig[roleKey];
                    const Icon = config.icon;
                    return (
                      <button
                        key={roleKey}
                        onClick={() => handleRoleSelect(roleKey)}
                        className={`w-full flex items-start gap-2 p-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                          roleKey === role ? 'bg-gray-50' : ''
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 ${config.color.split(' ')[0]}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {config.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {config.description}
                          </p>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </>
          )}
        </div>

        {/* Remove Button */}
        {canEdit && (
          <div className="relative">
            {showRemoveConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRemove}
                  className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRemoveConfirm(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Remove member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
