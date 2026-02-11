'use client';

/**
 * SkillSelectionPanel Component
 *
 * Reusable component for selecting multiple skills from a library.
 * Used in Collateral, Chat, RFPs, and other contexts.
 */

import { useState, useMemo } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Skill {
  id: string;
  title: string;
  summary?: string;
  categories?: string[];
}

interface SkillSelectionPanelProps {
  skills: Skill[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  isLoading?: boolean;
  maxHeight?: string;
  placeholder?: string;
  showSummary?: boolean;
  compact?: boolean;
}

export function SkillSelectionPanel({
  skills,
  selectedIds,
  onSelectionChange,
  isLoading = false,
  maxHeight = 'max-h-64',
  placeholder = 'Search skills...',
  showSummary = false,
  compact = false,
}: SkillSelectionPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills;

    const query = searchQuery.toLowerCase();
    return skills.filter((skill) =>
      skill.title.toLowerCase().includes(query) ||
      skill.summary?.toLowerCase().includes(query)
    );
  }, [skills, searchQuery]);

  const toggleSkill = (skillId: string) => {
    setSearchQuery('');
    onSelectionChange(
      selectedIds.includes(skillId)
        ? selectedIds.filter((id) => id !== skillId)
        : [...selectedIds, skillId]
    );
  };

  if (compact) {
    // Compact mode - just checkboxes
    return (
      <div className={`${maxHeight} overflow-y-auto space-y-1`}>
        {filteredSkills.slice(0, 20).map((skill) => (
          <label
            key={skill.id}
            className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(skill.id)}
              onChange={() => toggleSkill(skill.id)}
              disabled={isLoading}
              className="rounded border-gray-300"
            />
            <span className="text-sm truncate">{skill.title}</span>
          </label>
        ))}
        {filteredSkills.length > 20 && (
          <p className="text-xs text-gray-500 mt-2">
            Showing 20 of {filteredSkills.length} skills
          </p>
        )}
      </div>
    );
  }

  // Full mode with search
  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={isLoading}
          className="pl-8"
        />
      </div>

      {/* Skills List */}
      <div className={`${maxHeight} overflow-y-auto space-y-2 border rounded-lg p-3`}>
        {filteredSkills.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No skills found</p>
          </div>
        ) : (
          filteredSkills.map((skill) => (
            <label
              key={skill.id}
              className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(skill.id)}
                onChange={() => toggleSkill(skill.id)}
                disabled={isLoading}
                className="rounded border-gray-300 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{skill.title}</p>
                {showSummary && skill.summary && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{skill.summary}</p>
                )}
                {skill.categories && skill.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skill.categories.slice(0, 2).map((cat) => (
                      <span key={cat} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))
        )}
      </div>

      {/* Selection Summary */}
      {selectedIds.length > 0 && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          {selectedIds.length} skill{selectedIds.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}
