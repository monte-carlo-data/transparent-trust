'use client';

/**
 * Categories Section - Editor
 *
 * Allows editing categories with:
 * - Display of current categories
 * - Autocomplete suggestions from library
 * - Ability to create new categories
 */

import { useState, useEffect } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { LibraryId } from '@/types/v2/building-block';

interface Category {
  id: string;
  name: string;
}

interface CategoriesSectionProps {
  libraryId: LibraryId;
  categories: string[];
  onChange: (categories: string[]) => void;
}

export function CategoriesSection({
  libraryId,
  categories,
  onChange,
}: CategoriesSectionProps) {
  const [availableCategories, setAvailableCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available categories for this library
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/v2/categories?libraryId=${libraryId}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [libraryId]);

  // Filter suggestions: exclude already selected, match search
  const filteredSuggestions = availableCategories.filter(
    (cat) =>
      !categories.includes(cat.id) &&
      (searchInput === '' || cat.name.toLowerCase().includes(searchInput.toLowerCase()))
  );

  const handleAddCategory = (categoryId: string) => {
    if (!categories.includes(categoryId)) {
      onChange([...categories, categoryId]);
    }
    setSearchInput('');
    setShowSuggestions(false);
  };

  const handleCreateCategory = () => {
    if (searchInput.trim() === '') return;

    const categoryId = searchInput.toLowerCase().replace(/\s+/g, '-');

    // Check if it already exists
    if (!categories.includes(categoryId)) {
      onChange([...categories, categoryId]);
    }

    setSearchInput('');
    setShowSuggestions(false);
  };

  const handleRemoveCategory = (categoryId: string) => {
    onChange(categories.filter((cat) => cat !== categoryId));
  };

  return (
    <div className="space-y-4 border-b pb-6">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">
          Categories
        </label>

        {/* Current categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <div
                key={cat}
                className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
              >
                {cat}
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  className="text-blue-600 hover:text-blue-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search and add */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type to search or create category..."
                className="pl-10 w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleCreateCategory}
              disabled={!searchInput.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && searchInput && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 text-sm text-gray-500">Loading...</div>
              ) : filteredSuggestions.length > 0 ? (
                <div className="py-1">
                  {filteredSuggestions.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleAddCategory(cat.id)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      <div className="font-medium text-gray-900">{cat.name}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-sm text-gray-500">
                  No matching categories. Click &quot;Add&quot; to create &quot;{searchInput}&quot;
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
