'use client';

/**
 * V2 Contract Review Detail Page
 *
 * Single comprehensive analysis with split-pane UI:
 * - Skills selection panel
 * - Analysis trigger
 * - Split view: contract text (left) | findings list (right)
 * - Filtering and stats
 */

import { useState, useEffect, useCallback, use, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { StatsBar } from '@/components/v2/bulk-processing/StatsBar';
import { FilterBar } from '@/components/v2/bulk-processing/FilterBar';
import { ContractSplitView } from '@/components/v2/contracts/ContractSplitView';
import { SkillSelectionPanel } from '@/components/v2/contracts/SkillSelectionPanel';
import type { ContractFinding, AlignmentRating } from '@/types/contractReview';

type BulkProject = {
  id: string;
  name: string;
  description?: string;
  projectType: string;
  status: string;
  fileContext?: string;
  createdAt: string;
  updatedAt: string;
  config?: {
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    extractedTextLength?: number;
  };
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    outputData?: {
      overallRating?: string;
      summary?: string;
      findings?: ContractFinding[];
    };
    errorMessage?: string;
  }>;
};

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  ERROR: 'bg-red-100 text-red-800',
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<BulkProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [pollErrorCount, setPollErrorCount] = useState(0);

  const MAX_POLL_ERRORS = 3;

  // Filters
  const [ratingFilter, setRatingFilter] = useState<AlignmentRating | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'security' | 'legal' | 'compliance'>(
    'all'
  );
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v2/projects/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.data?.project || null);
      } else {
        toast.error('Contract not found');
      }
    } catch (error) {
      console.error('Failed to load contract:', error);
      toast.error('Failed to load contract');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Poll for status when analyzing
  useEffect(() => {
    if (!isAnalyzing) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v2/contracts/${id}/status`);

        if (!res.ok) {
          throw new Error(`Status check failed: ${res.status}`);
        }

        const json = await res.json();
        setPollErrorCount(0); // Reset on success

        if (json.success && json.data) {
          if (json.data.projectStatus === 'COMPLETED') {
            setIsAnalyzing(false);
            await loadProject();
            toast.success('Contract analysis complete!');
          } else if (json.data.projectStatus === 'ERROR') {
            setIsAnalyzing(false);
            await loadProject();
            toast.error('Analysis failed. Please try again.');
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);

        setPollErrorCount((prev) => prev + 1);

        if (pollErrorCount >= MAX_POLL_ERRORS) {
          setIsAnalyzing(false);
          toast.error(
            'Unable to check analysis status. The analysis may still be running. Please refresh the page to check.',
            { duration: 10000 }
          );
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [isAnalyzing, id, loadProject, pollErrorCount, MAX_POLL_ERRORS]);

  const handleStartAnalysis = async (skillIds: string[]) => {
    setShowSkillPanel(false);
    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/v2/contracts/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds,
          libraryId: 'knowledge',
          modelSpeed: 'quality',
        }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to start analysis');
      }

      toast.success('Analysis started! This may take 1-2 minutes.');
    } catch (error) {
      console.error('Failed to start analysis:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start analysis');
      setIsAnalyzing(false);
    }
  };

  // Extract findings from outputData
  const findings = useMemo(() => {
    if (!project?.rows?.[0]?.outputData?.findings) return [];
    return project.rows[0].outputData.findings;
  }, [project]);

  const overallRating = project?.rows?.[0]?.outputData?.overallRating;
  const summary = project?.rows?.[0]?.outputData?.summary;

  // Filter findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (ratingFilter !== 'all' && f.rating !== ratingFilter) return false;
      if (categoryFilter !== 'all') {
        const categoryBuckets = {
          security: [
            'data_protection',
            'security_controls',
            'certifications',
            'incident_response',
            'vulnerability_management',
            'access_control',
            'encryption',
            'penetration_testing',
          ],
          legal: [
            'liability',
            'indemnification',
            'limitation_of_liability',
            'insurance',
            'termination',
            'intellectual_property',
            'warranties',
            'governing_law',
          ],
          compliance: [
            'audit_rights',
            'subprocessors',
            'data_retention',
            'confidentiality',
            'regulatory_compliance',
          ],
        };
        if (!categoryBuckets[categoryFilter].includes(f.category)) return false;
      }
      if (showFlaggedOnly && !f.flaggedForReview) return false;
      return true;
    });
  }, [findings, ratingFilter, categoryFilter, showFlaggedOnly]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: findings.length,
      risks: findings.filter((f) => f.rating === 'risk').length,
      gaps: findings.filter((f) => f.rating === 'gap').length,
      partial: findings.filter((f) => f.rating === 'partial').length,
      canComply: findings.filter((f) => f.rating === 'can_comply').length,
    };
  }, [findings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Contract not found</h3>
        <Link href="/v2/contracts">
          <Button variant="outline">Back to Contracts</Button>
        </Link>
      </div>
    );
  }

  const hasContractText = !!project.fileContext && project.fileContext.length > 0;
  const hasFindings = findings.length > 0;
  const canAnalyze = hasContractText && (project.status === 'DRAFT' || project.status === 'COMPLETED');

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/v2/contracts"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contracts
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <Badge className={statusColors[project.status]}>{project.status}</Badge>
                {overallRating && (
                  <Badge
                    className={
                      overallRating === 'high_risk'
                        ? 'bg-red-100 text-red-800'
                        : overallRating === 'needs_review'
                        ? 'bg-orange-100 text-orange-800'
                        : overallRating === 'mostly_compliant'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }
                  >
                    {overallRating.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                )}
              </div>
              {project.description && <p className="text-gray-500">{project.description}</p>}
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                {project.config?.fileName && <span>File: {project.config.fileName}</span>}
                {project.config?.extractedTextLength && (
                  <span>{project.config.extractedTextLength.toLocaleString()} characters</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadProject} disabled={isAnalyzing}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            {canAnalyze && (
              <Button onClick={() => setShowSkillPanel(true)} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {hasFindings ? 'Re-analyze' : 'Analyze Contract'}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {summary && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Executive Summary</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Skills Selection Panel */}
      {showSkillPanel && (
        <SkillSelectionPanel
          projectId={id}
          isOpen={showSkillPanel}
          onClose={() => setShowSkillPanel(false)}
          onStartAnalysis={handleStartAnalysis}
        />
      )}

      {/* Stats Bar */}
      {hasFindings && (
        <StatsBar
          stats={[
            { label: 'Total Findings', value: stats.total },
            {
              label: 'Risks',
              value: stats.risks,
              colorClass: 'text-red-600',
              icon: <AlertCircle size={16} />,
            },
            {
              label: 'Gaps',
              value: stats.gaps,
              colorClass: 'text-orange-600',
              icon: <XCircle size={16} />,
            },
            {
              label: 'Partial',
              value: stats.partial,
              colorClass: 'text-yellow-600',
              icon: <AlertTriangle size={16} />,
            },
            {
              label: 'Can Comply',
              value: stats.canComply,
              colorClass: 'text-green-600',
              icon: <CheckCircle size={16} />,
            },
          ]}
        />
      )}

      {/* Filter Bar */}
      {hasFindings && (
        <FilterBar
          filters={[
            {
              key: 'rating',
              label: 'Rating',
              type: 'select',
              options: [
                { value: 'all', label: 'All Ratings' },
                { value: 'risk', label: 'Risk', count: stats.risks },
                { value: 'gap', label: 'Gap', count: stats.gaps },
                { value: 'partial', label: 'Partial', count: stats.partial },
                { value: 'can_comply', label: 'Can Comply', count: stats.canComply },
                {
                  value: 'info_only',
                  label: 'Info Only',
                  count: findings.filter((f) => f.rating === 'info_only').length,
                },
              ],
              value: ratingFilter,
              onChange: (v) => setRatingFilter(v as AlignmentRating | 'all'),
            },
            {
              key: 'category',
              label: 'Category',
              type: 'select',
              options: [
                { value: 'all', label: 'All Categories' },
                { value: 'security', label: 'Security' },
                { value: 'legal', label: 'Legal' },
                { value: 'compliance', label: 'Compliance' },
              ],
              value: categoryFilter,
              onChange: (v) => setCategoryFilter(v as typeof categoryFilter),
            },
            {
              key: 'flagged',
              label: 'Flagged Only',
              type: 'toggle',
              value: showFlaggedOnly,
              onChange: (v) => setShowFlaggedOnly(v as boolean),
            },
          ]}
          resultCount={filteredFindings.length}
          totalCount={findings.length}
          onClearAll={() => {
            setRatingFilter('all');
            setCategoryFilter('all');
            setShowFlaggedOnly(false);
          }}
        />
      )}

      {/* Split View */}
      {hasFindings && hasContractText && (
        <ContractSplitView
          contractText={project.fileContext || ''}
          findings={filteredFindings}
          selectedFindingId={selectedFindingId}
          onSelectFinding={setSelectedFindingId}
        />
      )}

      {/* Empty States */}
      {!hasContractText && (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contract uploaded</h3>
          <p className="text-gray-500 mb-4">Upload a contract file to begin analysis.</p>
        </Card>
      )}

      {hasContractText && !hasFindings && !isAnalyzing && (
        <Card className="p-12 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to analyze</h3>
          <p className="text-gray-500 mb-4">
            Click &quot;Analyze Contract&quot; to review this contract against your documented
            capabilities.
          </p>
          <Button onClick={() => setShowSkillPanel(true)}>
            <Play className="w-4 h-4 mr-2" />
            Analyze Contract
          </Button>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="p-12 text-center">
          <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing contract...</h3>
          <p className="text-gray-500">
            This may take 1-2 minutes. The page will update automatically when complete.
          </p>
        </Card>
      )}
    </div>
  );
}
