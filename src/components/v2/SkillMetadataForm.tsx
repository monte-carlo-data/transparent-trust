'use client';

/**
 * SkillMetadataForm
 *
 * Reusable component for editing skill metadata across all libraries.
 * Captures: categories, owners, visibility, and other properties.
 * Used in skill creation wizards and skill detail pages.
 */

import { useState } from 'react';
import Image from 'next/image';
import { X, Plus } from 'lucide-react';
import type { LibraryId } from '@/types/v2';

interface Owner {
  id: string;
  name: string;
  email?: string;
  image?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface ScopeDefinition {
  covers: string;
  futureAdditions: string[];
  notIncluded?: string[];
}

interface SkillMetadataFormProps {
  // Form state
  categories: string[];
  owners: Owner[];
  scopeDefinition?: ScopeDefinition;

  // Configuration
  availableCategories: Category[];
  availableUsers?: Owner[];
  libraryId: LibraryId;

  // Callbacks
  onCategoriesChange: (categories: string[]) => void;
  onOwnersChange: (owners: Owner[]) => void;
  onScopeDefinitionChange?: (scope: ScopeDefinition) => void;

  // Options
  isEditingExistingSkill?: boolean;
  showAdvanced?: boolean;
}

export function SkillMetadataForm({
  categories,
  owners,
  scopeDefinition,
  availableCategories,
  availableUsers = [],
  onCategoriesChange,
  onOwnersChange,
  onScopeDefinitionChange,
  showAdvanced = true,
}: SkillMetadataFormProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState('');

  // Filter available categories (exclude already selected)
  const filteredCategories = availableCategories.filter(
    (cat) =>
      !categories.includes(cat.id) &&
      cat.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Filter available users (exclude already selected)
  const filteredUsers = availableUsers.filter(
    (user) =>
      !owners.some((o) => o.id === user.id) &&
      (user.name?.toLowerCase().includes(ownerSearch.toLowerCase()) ||
        user.email?.toLowerCase().includes(ownerSearch.toLowerCase()))
  );

  const handleAddCategory = (categoryId: string) => {
    onCategoriesChange([...categories, categoryId]);
    setCategorySearch('');
    setShowCategoryDropdown(false);
  };

  const handleCreateAndAddCategory = () => {
    if (!newCategoryName.trim()) return;

    // Create a new category with a simple ID based on the name
    const categoryId = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    const newCategory: Category = {
      id: categoryId,
      name: newCategoryName,
    };

    // Add to available categories and to selected categories
    availableCategories.push(newCategory);
    onCategoriesChange([...categories, categoryId]);

    // Reset form
    setNewCategoryName('');
    setCategorySearch('');
  };

  const handleRemoveCategory = (categoryId: string) => {
    onCategoriesChange(categories.filter((c) => c !== categoryId));
  };

  const handleAddOwner = (owner: Owner) => {
    onOwnersChange([...owners, owner]);
    setOwnerSearch('');
    setShowOwnerDropdown(false);
  };

  const handleRemoveOwner = (ownerId: string) => {
    onOwnersChange(owners.filter((o) => o.id !== ownerId));
  };

  const getCategoryName = (categoryId: string) => {
    return availableCategories.find((c) => c.id === categoryId)?.name || categoryId;
  };

  return (
    <div className="space-y-6 p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Categories Section */}
      <div>
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
          Categories
        </label>
        <div className="space-y-3">
          {/* Selected categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((catId) => (
                <div
                  key={catId}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 rounded-lg text-sm"
                >
                  <span>{getCategoryName(catId)}</span>
                  <button
                    onClick={() => handleRemoveCategory(catId)}
                    className="hover:text-blue-900 dark:hover:text-blue-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add category dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                {/* Search/Create Input */}
                <input
                  type="text"
                  placeholder="Search or create new..."
                  value={categorySearch || newCategoryName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategorySearch(val);
                    setNewCategoryName(val);
                  }}
                  className="w-full px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm focus:outline-none dark:bg-gray-700 dark:text-white"
                />

                {/* Create new category button */}
                {newCategoryName.trim() && !filteredCategories.some((c) => c.name.toLowerCase() === newCategoryName.toLowerCase()) && (
                  <button
                    onClick={() => {
                      handleCreateAndAddCategory();
                      setShowCategoryDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create &quot;{newCategoryName}&quot;
                  </button>
                )}

                {/* Available categories */}
                <div className="max-h-48 overflow-y-auto">
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleAddCategory(cat.id)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div className="font-medium">{cat.name}</div>
                        {cat.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {cat.description}
                          </div>
                        )}
                      </button>
                    ))
                  ) : !newCategoryName.trim() ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      Type to search or create new
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Owners Section */}
      {showAdvanced && (
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
            Owners
          </label>
          <div className="space-y-3">
            {/* Selected owners */}
            {owners.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100 rounded-lg text-sm"
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
                      onClick={() => handleRemoveOwner(owner.id)}
                      className="hover:text-purple-900 dark:hover:text-purple-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add owner dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Plus className="w-4 h-4" />
                Add Owner
              </button>

              {showOwnerDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={ownerSearch}
                    onChange={(e) => setOwnerSearch(e.target.value)}
                    className="w-full px-3 py-2 border-b border-gray-200 dark:border-gray-700 text-sm focus:outline-none dark:bg-gray-700 dark:text-white"
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleAddOwner(user)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          {user.image && (
                            <Image
                              src={user.image}
                              alt={user.name}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          )}
                          <div>
                            <div className="font-medium">{user.name}</div>
                            {user.email && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {user.email}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No users available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scope Definition Section */}
      {showAdvanced && scopeDefinition && onScopeDefinitionChange && (
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
            Scope Definition
          </label>
          <div className="space-y-3">
            {/* Currently Covers */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Currently Covers
              </label>
              <textarea
                value={scopeDefinition.covers}
                onChange={(e) =>
                  onScopeDefinitionChange({
                    ...scopeDefinition,
                    covers: e.target.value,
                  })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="What does this skill cover?"
              />
            </div>

            {/* Future Additions */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Planned Additions (one per line)
              </label>
              <textarea
                value={scopeDefinition.futureAdditions.join('\n')}
                onChange={(e) =>
                  onScopeDefinitionChange({
                    ...scopeDefinition,
                    futureAdditions: e.target.value.split('\n').filter(s => s.trim()),
                  })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="What content should be added later?"
              />
            </div>

            {/* Not Included */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Explicitly Excluded (one per line)
              </label>
              <textarea
                value={(scopeDefinition.notIncluded || []).join('\n')}
                onChange={(e) =>
                  onScopeDefinitionChange({
                    ...scopeDefinition,
                    notIncluded: e.target.value.split('\n').filter(s => s.trim()),
                  })
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="What should not be included?"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
