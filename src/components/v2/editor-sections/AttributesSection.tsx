'use client';

/**
 * Attributes Section - Editor
 *
 * Allows editing skill attributes such as:
 * - Exposure (slackbot, chat, rfp)
 * - Owners/SMEs
 * - Skill Type
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getAttributeFields } from '@/lib/v2/editor-ui/editor-sections-config';
import type { LibraryId, SkillOwner } from '@/types/v2/building-block';
import Image from 'next/image';

interface Owner {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

interface AttributesSectionProps {
  libraryId: LibraryId;
  attributes: Record<string, unknown>;
  onChange: (attributes: Record<string, unknown>) => void;
}

export function AttributesSection({
  libraryId,
  attributes,
  onChange,
}: AttributesSectionProps) {
  const [availableUsers, setAvailableUsers] = useState<Owner[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [showOwnerSuggestions, setShowOwnerSuggestions] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fields = getAttributeFields(libraryId);
  const exposedTo = (attributes.exposedTo as string[]) || [];
  const owners = (attributes.owners as SkillOwner[]) || [];

  // Fetch available users for owner selection
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      try {
        const response = await fetch('/api/v2/users');
        if (response.ok) {
          const data = await response.json();
          setAvailableUsers(data.users || []);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    const ownerFields = fields.some((f) => f.key === 'owners');
    if (ownerFields) {
      fetchUsers();
    }
  }, [fields]);

  const handleExposureChange = (exposure: string, checked: boolean) => {
    const newExposed = checked
      ? [...exposedTo, exposure]
      : exposedTo.filter((e) => e !== exposure);
    onChange({ ...attributes, exposedTo: newExposed });
  };

  const handleAddOwner = (user: Owner) => {
    if (!owners.some((o) => o.userId === user.id)) {
      const newOwners = [
        ...owners,
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      ];
      onChange({ ...attributes, owners: newOwners });
    }
    setOwnerSearch('');
    setShowOwnerSuggestions(false);
  };

  const handleRemoveOwner = (userId: string | undefined) => {
    const newOwners = owners.filter((o) => o.userId !== userId);
    onChange({ ...attributes, owners: newOwners });
  };

  const filteredUsers = availableUsers.filter(
    (user) =>
      !owners.some((o) => o.userId === user.id) &&
      (user.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
        user.email?.toLowerCase().includes(ownerSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 border-b pb-6">
      {fields.map((field) => {
        if (field.type === 'checkboxes') {
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                {field.label}
                {field.hint && <p className="text-xs text-gray-500 font-normal mt-1">{field.hint}</p>}
              </label>
              <div className="space-y-2">
                {field.options?.map((option) => (
                  <label key={option} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={exposedTo.includes(option)}
                      onChange={(e) => handleExposureChange(option, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 capitalize">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        }

        if (field.type === 'user-picker') {
          return (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-900 mb-3">
                {field.label}
                {field.hint && <p className="text-xs text-gray-500 font-normal mt-1">{field.hint}</p>}
              </label>

              {/* Current owners */}
              {owners.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {owners.map((owner) => (
                    <div
                      key={owner.userId}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {owner.image && (
                        <Image
                          src={owner.image}
                          alt={owner.name}
                          width={16}
                          height={16}
                          className="rounded-full"
                        />
                      )}
                      <span>{owner.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOwner(owner.userId)}
                        className="text-gray-500 hover:text-gray-700 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Owner search */}
              <div className="relative">
                <input
                  type="text"
                  value={ownerSearch}
                  onChange={(e) => {
                    setOwnerSearch(e.target.value);
                    setShowOwnerSuggestions(true);
                  }}
                  onFocus={() => setShowOwnerSuggestions(true)}
                  placeholder="Search for users to add..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* User suggestions dropdown */}
                {showOwnerSuggestions && ownerSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {isLoadingUsers ? (
                      <div className="p-3 text-sm text-gray-500">Loading...</div>
                    ) : filteredUsers.length > 0 ? (
                      <div className="py-1">
                        {filteredUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleAddOwner(user)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm flex items-center gap-2"
                          >
                            {user.image && (
                              <Image
                                src={user.image}
                                alt={user.name}
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-gray-500">No users found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
