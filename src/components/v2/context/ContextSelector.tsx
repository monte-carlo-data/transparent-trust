"use client";

import { useState, useEffect } from "react";
import { AlertCircle, Info } from "lucide-react";

interface ContextSelectorProps {
  library: string;
  onLibraryChange: (library: string) => void;
  categories?: string[];
  onCategoriesChange?: (categories: string[]) => void;
  batchSize?: number;
  onBatchSizeChange?: (size: number) => void;
  questionCount?: number;
  isLoading?: boolean;
}

interface CategoryItem {
  id: string;
  name: string;
}

export function ContextSelector({
  library,
  onLibraryChange,
  categories = [],
  onCategoriesChange,
  batchSize = 10,
  onBatchSizeChange,
  questionCount = 1,
  isLoading = false,
}: ContextSelectorProps) {
  const [contextInfo, setContextInfo] = useState<{
    fits: boolean;
    skillCount: number;
    utilizationPercent: number;
    suggestedBatchSize: number;
  } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Load available categories from skills
  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const params = new URLSearchParams();
        if (library) {
          params.append("libraryId", library);
        }
        const response = await fetch(`/api/v2/categories?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories || []);
        }
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, [library]);

  // Estimate context fit
  useEffect(() => {
    const fetchContextInfo = async () => {
      setContextLoading(true);
      try {
        const params = new URLSearchParams({
          library,
          questionCount: String(questionCount),
        });

        if (categories.length > 0) {
          params.append('categories', categories.join(','));
        }

        const response = await fetch(`/api/v2/context/estimate?${params}`);
        if (response.ok) {
          const data = await response.json();
          setContextInfo(data.data || data);
        } else {
          // Fallback to default values if API fails
          setContextInfo({
            fits: true,
            skillCount: 30,
            utilizationPercent: 45,
            suggestedBatchSize: 10,
          });
        }
      } catch (error) {
        console.error('Failed to fetch context estimate:', error);
        // Fallback to default values
        setContextInfo({
          fits: true,
          skillCount: 30,
          utilizationPercent: 45,
          suggestedBatchSize: 10,
        });
      } finally {
        setContextLoading(false);
      }
    };

    fetchContextInfo();
  }, [library, categories, questionCount]);

  return (
    <div className="border rounded-lg p-4 bg-white space-y-4">
      <h3 className="font-semibold text-slate-900">Processing Options</h3>

      {/* Library Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Knowledge Library
        </label>
        <select
          value={library}
          onChange={(e) => onLibraryChange(e.target.value)}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
        >
          <option value="skills">General Skills</option>
          <option value="it-skills">IT Skills</option>
          <option value="customers">Customers</option>
        </select>
      </div>

      {/* Category Selection */}
      {onCategoriesChange && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Filter by Categories (Optional)
          </label>
          {categoriesLoading ? (
            <p className="text-sm text-slate-500">Loading categories...</p>
          ) : availableCategories.length > 0 ? (
            <div className="space-y-2">
              {availableCategories.map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categories.includes(cat.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onCategoriesChange([...categories, cat.id]);
                      } else {
                        onCategoriesChange(categories.filter((c) => c !== cat.id));
                      }
                    }}
                    disabled={isLoading}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-slate-700">{cat.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No categories available</p>
          )}
        </div>
      )}

      {/* Context Information */}
      {contextInfo && (
        <div className={`p-3 rounded border text-sm ${
          contextInfo.fits
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-yellow-50 border-yellow-200 text-yellow-800"
        }`}>
          <div className="flex items-start gap-2">
            {contextInfo.fits ? (
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">
                Context Utilization: {contextInfo.utilizationPercent}%
              </p>
              <p className="text-xs mt-1">
                {contextInfo.skillCount} skills loaded · Suggested batch size: {contextInfo.suggestedBatchSize}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Size */}
      {onBatchSizeChange && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Batch Size
          </label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((size) => (
              <button
                key={size}
                onClick={() => onBatchSizeChange(size)}
                disabled={isLoading || contextLoading}
                className={`px-3 py-1 text-sm rounded border transition-colors ${
                  batchSize === size
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {size}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {contextInfo?.suggestedBatchSize && (
              <>Recommended: {contextInfo.suggestedBatchSize}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
