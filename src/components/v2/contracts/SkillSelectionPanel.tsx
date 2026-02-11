/**
 * SkillSelectionPanel Component
 *
 * Inline panel for selecting skills before contract analysis.
 * Fetches available skills and allows user to select which to use.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronUp, AlertCircle, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface SkillPreview {
  skillId: string;
  skillTitle: string;
  scopeCovers: string;
  estimatedTokens: number;
  isCustomerSkill: boolean;
}

export interface SkillSelectionPanelProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartAnalysis: (skillIds: string[]) => void;
}

export function SkillSelectionPanel({
  projectId,
  isOpen,
  onClose,
  onStartAnalysis,
}: SkillSelectionPanelProps) {
  const [skills, setSkills] = useState<SkillPreview[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v2/contracts/${projectId}/preview-skills?libraryId=knowledge`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to load skills');
      }

      if (json.success && json.data.skills) {
        setSkills(json.data.skills);
        // Pre-select all skills by default
        setSelectedSkillIds(new Set(json.data.skills.map((s: SkillPreview) => s.skillId)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadSkills();
    }
  }, [isOpen, loadSkills]);

  const handleToggle = (skillId: string) => {
    const next = new Set(selectedSkillIds);
    if (next.has(skillId)) {
      next.delete(skillId);
    } else {
      next.add(skillId);
    }
    setSelectedSkillIds(next);
  };

  const handleSelectAll = () => {
    setSelectedSkillIds(new Set(skills.map((s) => s.skillId)));
  };

  const handleSelectNone = () => {
    setSelectedSkillIds(new Set());
  };

  const handleStartAnalysis = () => {
    onStartAnalysis(Array.from(selectedSkillIds));
  };

  if (!isOpen) return null;

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Select Skills for Contract Analysis</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronUp size={16} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading skills...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Failed to load skills</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadSkills}
                  className="mt-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && skills.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No skills available. Create skills in the Knowledge library first.
          </div>
        )}

        {!isLoading && !error && skills.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectNone}>
                  Select None
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                {selectedSkillIds.size} of {skills.length} selected
              </span>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded p-3 bg-white">
              {skills.map((skill) => (
                <div key={skill.skillId} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded">
                  <Checkbox
                    id={skill.skillId}
                    checked={selectedSkillIds.has(skill.skillId)}
                    onCheckedChange={() => handleToggle(skill.skillId)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={skill.skillId} className="font-medium cursor-pointer">
                      {skill.skillTitle}
                      {skill.isCustomerSkill && (
                        <span className="ml-2 text-xs text-purple-600 font-normal">
                          (Customer Skill)
                        </span>
                      )}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {skill.scopeCovers}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <span className="text-sm text-gray-600">
                {selectedSkillIds.size} skills selected
              </span>
              <Button
                onClick={handleStartAnalysis}
                disabled={selectedSkillIds.size === 0}
                size="sm"
              >
                Start Analysis
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
