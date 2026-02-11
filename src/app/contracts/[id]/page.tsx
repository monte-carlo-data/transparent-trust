"use client";

import { useState, useEffect, useCallback, use, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Flag, Check, Plus, RefreshCw, ChevronDown, ChevronUp, FileText, X, Download, Shield, MessageSquareText } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ContractReview, ContractFinding, AlignmentRating, FindingCategory } from "@/types/contractReview";
import { parseApiData } from "@/lib/apiClient";

const ratingConfig: Record<string, { className: string; label: string }> = {
  compliant: { className: "bg-green-100 text-green-800", label: "Compliant" },
  mostly_compliant: { className: "bg-yellow-100 text-yellow-800", label: "Mostly Compliant" },
  needs_review: { className: "bg-orange-100 text-orange-800", label: "Needs Review" },
  high_risk: { className: "bg-red-100 text-red-800", label: "High Risk" },
};

const alignmentConfig: Record<AlignmentRating, { className: string; label: string; borderColor: string }> = {
  can_comply: { className: "bg-green-100 text-green-800", label: "Can Comply", borderColor: "border-l-green-500" },
  partial: { className: "bg-yellow-100 text-yellow-800", label: "Partial", borderColor: "border-l-yellow-500" },
  gap: { className: "bg-orange-100 text-orange-800", label: "Gap", borderColor: "border-l-orange-500" },
  risk: { className: "bg-red-100 text-red-800", label: "Risk", borderColor: "border-l-red-500" },
  info_only: { className: "bg-blue-100 text-blue-800", label: "Info Only", borderColor: "border-l-blue-500" },
};

const categoryLabels: Record<FindingCategory, string> = {
  // Security
  data_protection: "Data Protection",
  security_controls: "Security Controls",
  certifications: "Certifications",
  incident_response: "Incident Response",
  vulnerability_management: "Vulnerability Mgmt",
  access_control: "Access Control",
  encryption: "Encryption",
  penetration_testing: "Pen Testing",
  // Legal
  liability: "Liability",
  indemnification: "Indemnification",
  limitation_of_liability: "Limitation of Liability",
  insurance: "Insurance",
  termination: "Termination",
  intellectual_property: "IP Rights",
  warranties: "Warranties",
  governing_law: "Governing Law",
  // Compliance
  audit_rights: "Audit Rights",
  subprocessors: "Subprocessors",
  data_retention: "Data Retention",
  confidentiality: "Confidentiality",
  regulatory_compliance: "Regulatory",
  // General
  sla_performance: "SLA/Performance",
  payment_terms: "Payment Terms",
  other: "Other",
};

// Category buckets for filtering
type CategoryBucket = "all" | "security" | "legal" | "compliance" | "general";

const categoryBuckets: Record<CategoryBucket, { label: string; categories: FindingCategory[] }> = {
  all: { label: "All Categories", categories: [] },
  security: {
    label: "Security",
    categories: ["data_protection", "security_controls", "certifications", "incident_response", "vulnerability_management", "access_control", "encryption", "penetration_testing"],
  },
  legal: {
    label: "Legal",
    categories: ["liability", "indemnification", "limitation_of_liability", "insurance", "termination", "intellectual_property", "warranties", "governing_law"],
  },
  compliance: {
    label: "Compliance",
    categories: ["audit_rights", "subprocessors", "data_retention", "confidentiality", "regulatory_compliance"],
  },
  general: {
    label: "General",
    categories: ["sla_performance", "payment_terms", "other"],
  },
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [contract, setContract] = useState<ContractReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterRating, setFilterRating] = useState<AlignmentRating | "all">("all");
  const [filterCategoryBucket, setFilterCategoryBucket] = useState<CategoryBucket>("all");
  const [filterSecurityOnly, setFilterSecurityOnly] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showFullContract, setShowFullContract] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null);
  const [manualFlagText, setManualFlagText] = useState<string | null>(null);
  const [manualFlagNote, setManualFlagNote] = useState("");
  const [manualFlagCategory, setManualFlagCategory] = useState<FindingCategory>("other");
  const [manualFlagRating, setManualFlagRating] = useState<AlignmentRating>("risk");
  const [creatingManualFlag, setCreatingManualFlag] = useState(false);

  const fetchContract = useCallback(async () => {
    try {
      const response = await fetch(`/api/contracts/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Contract not found");
        }
        throw new Error("Failed to fetch contract");
      }
      const json = await response.json();
      const data = parseApiData<ContractReview>(json, "contract");
      setContract(data);
      setNotes(data.notes || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleSaveNotes = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) throw new Error("Failed to save notes");
      toast.success("Notes saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkReviewed = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      const reviewerName = session?.user?.name || session?.user?.email || "Unknown";
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REVIEWED",
          notes,
          reviewedBy: reviewerName,
        }),
      });
      if (!response.ok) throw new Error("Failed to mark as reviewed");
      const json = await response.json();
      setContract(parseApiData<ContractReview>(json));
      toast.success("Contract marked as reviewed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!contract?.extractedText) return;
    const blob = new Blob([contract.extractedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract.name || "contract"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportFeedback = async () => {
    if (!contract) return;
    try {
      const response = await fetch(`/api/contracts/${id}/feedback`);
      if (!response.ok) throw new Error("Failed to export feedback");
      const json = await response.json();
      const data = json.data;

      // Download as JSON for now - can be enhanced to use in chat/accuracy page
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contract.name || "contract"}-feedback.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show summary
      const { stats } = data;
      if (stats.manuallyAdded > 0 || stats.responsesEdited > 0 || stats.ratingsChanged > 0) {
        toast.success(`Exported feedback: ${stats.manuallyAdded} manual additions, ${stats.responsesEdited} edits`);
      } else {
        toast.info("No feedback to export - no corrections made to this review");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export feedback");
    }
  };

  const handleReanalyze = async () => {
    if (!contract) return;
    setReanalyzing(true);
    try {
      const response = await fetch(`/api/contracts/${id}/analyze`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        const errorMessage = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(errorMessage || "Re-analysis failed");
      }
      toast.success("Contract re-analyzed successfully");
      // Refresh contract data
      await fetchContract();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-analysis failed");
    } finally {
      setReanalyzing(false);
    }
  };

  // Handle text selection for manual flagging
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 10) {
      setManualFlagText(selection.toString().trim());
      setManualFlagNote("");
      setManualFlagCategory("other");
      setManualFlagRating("risk");
    }
  };

  // Create a manual finding from selected text
  const handleCreateManualFlag = async () => {
    if (!contract || !manualFlagText) return;
    setCreatingManualFlag(true);
    try {
      const response = await fetch(`/api/contracts/${id}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauseText: manualFlagText,
          category: manualFlagCategory,
          rating: manualFlagRating,
          rationale: manualFlagNote || "Manually flagged for review",
          flaggedForReview: true,
          flagNote: "Manually added",
          flaggedBy: session?.user?.name || session?.user?.email || "User",
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        const errorMessage = typeof data.error === 'object' ? data.error?.message : data.error;
        throw new Error(errorMessage || "Failed to create finding");
      }
      toast.success("Finding added");
      setManualFlagText(null);
      setManualFlagNote("");
      // Refresh contract data
      await fetchContract();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add finding");
    } finally {
      setCreatingManualFlag(false);
    }
  };

  const handleToggleFlag = async (finding: ContractFinding) => {
    if (!contract) return;

    try {
      const response = await fetch(`/api/contracts/${id}/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flaggedForReview: !finding.flaggedForReview,
          flagNote: !finding.flaggedForReview ? "Manually flagged for review" : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to update finding");

      // Update local state
      setContract((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === finding.id
              ? { ...f, flaggedForReview: !f.flaggedForReview }
              : f
          ),
        };
      });
      toast.success(finding.flaggedForReview ? "Flag removed" : "Finding flagged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleToggleSecurityReview = async (finding: ContractFinding) => {
    if (!contract) return;

    try {
      const response = await fetch(`/api/contracts/${id}/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToSecurity: !finding.assignedToSecurity,
        }),
      });
      if (!response.ok) throw new Error("Failed to update finding");

      // Update local state
      setContract((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === finding.id
              ? { ...f, assignedToSecurity: !f.assignedToSecurity }
              : f
          ),
        };
      });
      toast.success(finding.assignedToSecurity ? "Removed from security review" : "Sent to security for review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  // Computed values
  const findings = useMemo(() => contract?.findings ?? [], [contract?.findings]);
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      if (filterRating !== "all" && f.rating !== filterRating) return false;
      if (filterCategoryBucket !== "all") {
        const bucket = categoryBuckets[filterCategoryBucket];
        if (!bucket.categories.includes(f.category)) return false;
      }
      if (filterSecurityOnly && !f.assignedToSecurity) return false;
      return true;
    });
  }, [findings, filterRating, filterCategoryBucket, filterSecurityOnly]);

  const stats = useMemo(() => ({
    total: findings.length,
    risks: findings.filter((f) => f.rating === "risk").length,
    gaps: findings.filter((f) => f.rating === "gap").length,
    flagged: findings.filter((f) => f.flaggedForReview).length,
    securityReview: findings.filter((f) => f.assignedToSecurity).length,
  }), [findings]);

  // Helper to highlight clause text in contract
  const getHighlightedContract = useMemo(() => {
    if (!contract?.extractedText) return "";

    const text = contract.extractedText;
    const clauseLocations: Array<{ start: number; end: number; finding: ContractFinding }> = [];

    // Find all clause positions in the contract text
    filteredFindings.forEach((finding) => {
      // Normalize both texts for better matching
      const normalizedClause = finding.clauseText.trim().toLowerCase();
      const normalizedText = text.toLowerCase();
      const index = normalizedText.indexOf(normalizedClause);
      if (index !== -1) {
        clauseLocations.push({
          start: index,
          end: index + finding.clauseText.length,
          finding,
        });
      }
    });

    // Sort by position (reverse to not mess up indices when inserting markers)
    clauseLocations.sort((a, b) => b.start - a.start);

    return { text, clauseLocations };
  }, [contract?.extractedText, filteredFindings]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <InlineLoader size="lg" className="text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Link href="/contracts" className="text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Contracts
        </Link>
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-6 text-center text-destructive">
            {error || "Contract not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const overallRating = ratingConfig[contract.overallRating || "needs_review"];

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Back link */}
      <Link href="/contracts" className="text-primary hover:underline flex items-center gap-1 mb-4 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Contracts
      </Link>

      {/* Header */}
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{contract.name}</h1>
          <div className="text-sm text-muted-foreground">
            {contract.customerName && <span>{contract.customerName} • </span>}
            {contract.contractType && <span>{contract.contractType} • </span>}
            <span>Uploaded {new Date(contract.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Badge className={overallRating.className}>{overallRating.label}</Badge>
          <Badge className={contract.status === "REVIEWED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
            {contract.status}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="text-center">
          <CardContent className="py-4">
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Findings</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className={cn("text-3xl font-bold", stats.risks > 0 ? "text-red-600" : "text-muted-foreground")}>
              {stats.risks}
            </div>
            <div className="text-sm text-muted-foreground">Risks</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className={cn("text-3xl font-bold", stats.gaps > 0 ? "text-orange-600" : "text-muted-foreground")}>
              {stats.gaps}
            </div>
            <div className="text-sm text-muted-foreground">Gaps</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className={cn("text-3xl font-bold", stats.flagged > 0 ? "text-amber-600" : "text-muted-foreground")}>
              {stats.flagged}
            </div>
            <div className="text-sm text-muted-foreground">Flagged</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-4">
            <div className={cn("text-3xl font-bold", stats.securityReview > 0 ? "text-purple-600" : "text-muted-foreground")}>
              {stats.securityReview}
            </div>
            <div className="text-sm text-muted-foreground">Security Review</div>
          </CardContent>
        </Card>
      </div>

      {/* Full Contract Text */}
      {contract.extractedText && (
        <Card className="mb-6">
          <CardHeader
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowFullContract(!showFullContract)}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Full Contract Text</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {contract.extractedText.length.toLocaleString()} characters
                </Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {showFullContract ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {showFullContract && (
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {contract.extractedText}
                </pre>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Findings Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h2 className="text-lg font-semibold">Findings ({filteredFindings.length})</h2>
        <div className="flex gap-3 items-center">
          <Select value={filterRating} onValueChange={(v) => setFilterRating(v as AlignmentRating | "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              {Object.entries(alignmentConfig).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategoryBucket} onValueChange={(v) => setFilterCategoryBucket(v as CategoryBucket)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryBuckets).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={filterSecurityOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSecurityOnly(!filterSecurityOnly)}
            className={cn(
              filterSecurityOnly && "bg-purple-600 hover:bg-purple-700"
            )}
          >
            <Shield className="h-4 w-4 mr-2" />
            Needs Security Review
            {stats.securityReview > 0 && (
              <Badge variant="secondary" className={cn("ml-2", filterSecurityOnly && "bg-purple-100 text-purple-800")}>
                {stats.securityReview}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Side-by-Side View */}
      {contract.extractedText ? (
        <div className="grid grid-cols-2 gap-4 mb-6" style={{ height: "70vh" }}>
          {/* Contract Text Panel */}
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3 border-b flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Contract Text</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">Select text to add a flag</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1" onMouseUp={handleTextSelection}>
              <div className="text-sm leading-relaxed">
                {(() => {
                  const { text, clauseLocations } = getHighlightedContract as { text: string; clauseLocations: Array<{ start: number; end: number; finding: ContractFinding }> };
                  if (clauseLocations.length === 0) {
                    return <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{text}</pre>;
                  }

                  // Build segments with highlights
                  const segments: Array<{ text: string; finding?: ContractFinding }> = [];
                  let lastEnd = 0;

                  // Sort by start position for rendering
                  const sortedLocations = [...clauseLocations].sort((a, b) => a.start - b.start);

                  sortedLocations.forEach(({ start, end, finding }) => {
                    if (start > lastEnd) {
                      segments.push({ text: text.slice(lastEnd, start) });
                    }
                    segments.push({ text: text.slice(start, end), finding });
                    lastEnd = end;
                  });

                  if (lastEnd < text.length) {
                    segments.push({ text: text.slice(lastEnd) });
                  }

                  return (
                    <pre className="whitespace-pre-wrap font-sans">
                      {segments.map((segment, i) => {
                        if (segment.finding) {
                          const alignment = alignmentConfig[segment.finding.rating];
                          const isSelected = selectedFinding === segment.finding.id;
                          return (
                            <mark
                              key={i}
                              id={`clause-${segment.finding.id}`}
                              className={cn(
                                "cursor-pointer px-1 rounded transition-all",
                                isSelected ? "ring-2 ring-primary ring-offset-1" : "",
                                segment.finding.rating === "risk" && "bg-red-200 hover:bg-red-300",
                                segment.finding.rating === "gap" && "bg-orange-200 hover:bg-orange-300",
                                segment.finding.rating === "partial" && "bg-yellow-200 hover:bg-yellow-300",
                                segment.finding.rating === "can_comply" && "bg-green-200 hover:bg-green-300",
                                segment.finding.rating === "info_only" && "bg-blue-200 hover:bg-blue-300"
                              )}
                              onClick={() => setSelectedFinding(segment.finding!.id)}
                              title={`${alignment.label}: ${segment.finding.category}`}
                            >
                              {segment.text}
                            </mark>
                          );
                        }
                        return <span key={i} className="text-muted-foreground">{segment.text}</span>;
                      })}
                    </pre>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Findings Panel */}
          <Card className="overflow-hidden flex flex-col">
            <CardHeader className="py-3 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Findings</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {filteredFindings.filter(f => f.flaggedForReview).length} flagged
                </Badge>
              </div>
              {/* Manual flag creation panel */}
              {manualFlagText && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold text-amber-800">Add Finding for Selected Text</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-amber-600"
                      onClick={() => setManualFlagText(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-amber-700 italic mb-2 line-clamp-2">
                    &ldquo;{manualFlagText}&rdquo;
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Select value={manualFlagRating} onValueChange={(v) => setManualFlagRating(v as AlignmentRating)}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(alignmentConfig).map(([key, { label }]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={manualFlagCategory} onValueChange={(v) => setManualFlagCategory(v as FindingCategory)}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    value={manualFlagNote}
                    onChange={(e) => setManualFlagNote(e.target.value)}
                    placeholder="Add a note about why this needs review..."
                    className="text-xs min-h-[60px] mb-2"
                  />
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={handleCreateManualFlag}
                    disabled={creatingManualFlag}
                  >
                    {creatingManualFlag ? "Adding..." : "Add Finding"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-2 overflow-y-auto flex-1">
              {filteredFindings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No findings match the current filters.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredFindings.map((finding) => {
                    const alignment = alignmentConfig[finding.rating];
                    const isSelected = selectedFinding === finding.id;
                    return (
                      <div
                        key={finding.id}
                        className={cn(
                          "border rounded-lg p-3 border-l-4 cursor-pointer transition-all text-sm",
                          alignment.borderColor,
                          isSelected && "ring-2 ring-primary",
                          finding.flaggedForReview && "bg-amber-50"
                        )}
                        onClick={() => {
                          setSelectedFinding(finding.id);
                          // Scroll to clause in contract
                          const clauseEl = document.getElementById(`clause-${finding.id}`);
                          if (clauseEl) {
                            clauseEl.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge className={cn(alignment.className, "text-xs")}>{alignment.label}</Badge>
                            <Badge variant="secondary" className="text-xs">{categoryLabels[finding.category]}</Badge>
                            {finding.flaggedForReview && (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">
                                <Flag className="h-2.5 w-2.5 mr-0.5" />
                                Flagged
                              </Badge>
                            )}
                            {finding.assignedToSecurity && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                <Shield className="h-2.5 w-2.5 mr-0.5" />
                                Security
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSecurityReview(finding);
                              }}
                              className={cn(
                                "h-6 w-6 p-0",
                                finding.assignedToSecurity
                                  ? "text-purple-600 hover:text-purple-700"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={finding.assignedToSecurity ? "Remove from security review" : "Send to security review"}
                            >
                              <Shield className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFlag(finding);
                              }}
                              className={cn(
                                "h-6 w-6 p-0",
                                finding.flaggedForReview
                                  ? "text-amber-600 hover:text-amber-700"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={finding.flaggedForReview ? "Remove flag" : "Flag for review"}
                            >
                              <Flag className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mb-2 line-clamp-2 italic">
                          &ldquo;{finding.clauseText}&rdquo;
                        </div>

                        <div className="text-xs text-muted-foreground line-clamp-3">
                          {finding.rationale}
                        </div>

                        {finding.suggestedResponse && (
                          <details className="mt-2">
                            <summary className="bg-blue-50 p-2 rounded text-xs text-blue-800 cursor-pointer hover:bg-blue-100">
                              <span className="font-medium">Suggested Response</span>
                            </summary>
                            <div className="bg-blue-50 px-2 pb-2 rounded-b text-xs text-blue-800">
                              {finding.suggestedResponse}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="mb-6">
          <CardContent className="py-8 text-center text-muted-foreground">
            No contract text available to display.
          </CardContent>
        </Card>
      )}

      {/* Review Notes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Review Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this contract review..."
            className="min-h-[100px] mb-4"
          />
          <div className="flex gap-3 items-center flex-wrap">
            <Button onClick={handleSaveNotes} disabled={saving} variant="outline">
              {saving ? "Saving..." : "Save Notes"}
            </Button>
            {contract.status !== "REVIEWED" && (
              <Button onClick={handleMarkReviewed} disabled={saving} className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-2" />
                Mark as Reviewed
              </Button>
            )}
            {contract.reviewedAt && (
              <span className="text-sm text-muted-foreground">
                Reviewed on {new Date(contract.reviewedAt).toLocaleDateString()}
                {contract.reviewedBy && ` by ${contract.reviewedBy}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          onClick={handleExportFeedback}
        >
          <MessageSquareText className="h-4 w-4 mr-2" />
          Export Feedback
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={!contract.extractedText}
        >
          <Download className="h-4 w-4 mr-2" />
          Download Text
        </Button>
        <Button
          variant="outline"
          onClick={handleReanalyze}
          disabled={reanalyzing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", reanalyzing && "animate-spin")} />
          {reanalyzing ? "Re-analyzing..." : "Re-analyze"}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contracts/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload New Contract
          </Link>
        </Button>
      </div>
    </div>
  );
}
