'use client';

import { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';

interface CategoryManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categories: string[]) => Promise<void>;
  currentCategories: string[];
  availableCategories?: string[];
  isSaving?: boolean;
}

export default function CategoryManagementDialog({
  isOpen,
  onClose,
  onSave,
  currentCategories,
  availableCategories = [],
  isSaving = false,
}: CategoryManagementDialogProps) {
  const [categories, setCategories] = useState(currentCategories);
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (category: string) => {
    setCategories(categories.filter((c) => c !== category));
  };

  const handleSave = async () => {
    await onSave(categories);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Manage Categories</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Selected Categories */}
          {categories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Selected</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    <span>{category}</span>
                    <button
                      onClick={() => handleRemoveCategory(category)}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Category */}
          <div>
            <h3 className="text-sm font-semibold mb-2">
              {categories.length > 0 ? 'Add Another' : 'Add Category'}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                }}
                placeholder="New category..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCategory.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Suggested Categories */}
          {availableCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Suggestions</h3>
              <div className="flex flex-wrap gap-2">
                {availableCategories
                  .filter((cat) => !categories.includes(cat))
                  .slice(0, 8)
                  .map((category) => (
                    <button
                      key={category}
                      onClick={() =>
                        setCategories([...categories, category])
                      }
                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      + {category}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
