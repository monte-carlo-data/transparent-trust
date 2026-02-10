"use client";

/**
 * V2 Prompt Registry
 *
 * Central hub for system prompts and blocks with:
 * - Compositions view showing how blocks combine into prompts
 * - Individual blocks view with inline editing
 * - Version history and tier-based warnings
 * - Live preview of assembled prompts
 */

import { useState, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Search,
  Filter,
  Lock,
  AlertTriangle,
  Edit3,
  History,
  RotateCcw,
  ChevronRight,
  Code2,
  Layers,
  X,
  Check,
  Eye,
  ChevronDown,
  ArrowLeft,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { isUserAdmin, type SessionUser } from "@/lib/auth-v2";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ManagedPrompt } from "@/lib/prompts/prompt-service";
import { coreBlocks } from "@/lib/v2/prompts/blocks/core-blocks";
import { allCompositions } from "@/lib/v2/prompts/compositions";
import type { PromptBlock, CompositionCategory, CompositionUsage } from "@/lib/v2/prompts/types";
import { COMPOSITION_CATEGORY_CONFIG } from "@/lib/v2/prompts/types";
import { estimateTokens } from "@/lib/tokenUtils";
import TokenCountBadge from "@/components/v2/tokens/TokenCountBadge";

// =============================================================================
// TYPES
// =============================================================================

type TabType = "compositions" | "blocks";
type TierFilter = "all" | 1 | 2 | 3;

interface VersionEntry {
  version: number;
  content: string;
  commitMessage: string;
  changedBy: string;
  changedAt: string;
  diff?: string;
}

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

const TIER_CONFIG = {
  1: {
    label: "Locked",
    description: "Core system functionality - changes may break features",
    icon: Lock,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  2: {
    label: "Caution",
    description: "Important for accuracy - customize carefully",
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  3: {
    label: "Open",
    description: "Safe to customize - style and personalization",
    icon: Edit3,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
};

const CATEGORY_COLORS: Record<CompositionCategory, string> = {
  chat_rfp: "bg-blue-100 text-blue-700 border-blue-200",
  skills: "bg-green-100 text-green-700 border-green-200",
  foundational: "bg-purple-100 text-purple-700 border-purple-200",
  slack_bots: "bg-orange-100 text-orange-700 border-orange-200",
  customer_views: "bg-pink-100 text-pink-700 border-pink-200",
  contract: "bg-red-100 text-red-700 border-red-200",
  utility: "bg-gray-100 text-gray-700 border-gray-200",
  collateral: "bg-teal-100 text-teal-700 border-teal-200",
};

const USAGE_TYPE_ICONS: Record<CompositionUsage['type'], { icon: typeof Code2; label: string }> = {
  api: { icon: Code2, label: "API" },
  ui: { icon: Eye, label: "UI" },
  internal: { icon: Layers, label: "Internal" },
};

// =============================================================================
// BADGE COMPONENTS
// =============================================================================

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        config.bgColor,
        config.color
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: CompositionCategory }) {
  const config = COMPOSITION_CATEGORY_CONFIG[category];
  const colorClass = CATEGORY_COLORS[category];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
        colorClass
      )}
    >
      {config.label}
    </span>
  );
}

function UsedByIndicator({ usedBy }: { usedBy: CompositionUsage[] }) {
  if (!usedBy || usedBy.length === 0) {
    return (
      <span className="text-xs text-slate-400 italic">
        No usage tracked
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {usedBy.map((usage, index) => {
        const typeConfig = USAGE_TYPE_ICONS[usage.type];
        const Icon = typeConfig.icon;
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200"
            title={`${usage.location} (${typeConfig.label})`}
          >
            <Icon className="h-3 w-3" />
            {usage.feature}
          </span>
        );
      })}
    </div>
  );
}

// =============================================================================
// DIALOG COMPONENTS
// =============================================================================

function TierWarningDialog({
  open,
  tier,
  blockName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  tier: 1 | 2;
  blockName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = TIER_CONFIG[tier];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className={cn("flex items-center gap-2", config.color)}>
            {tier === 1 ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            Edit {config.label} Block
          </DialogTitle>
          <DialogDescription className="pt-2">
            <strong>{blockName}</strong> is a {config.label.toLowerCase()} block.
            <br />
            <br />
            {tier === 1 ? (
              <>
                <span className="text-red-600 font-medium">Warning:</span> This block is critical
                system functionality. Changes may break features or cause unexpected behavior.
              </>
            ) : (
              <>
                <span className="text-yellow-600 font-medium">Caution:</span> This block is
                important for accuracy. Edit carefully and test your changes.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={tier === 1 ? "destructive" : "default"}
            onClick={onConfirm}
          >
            I understand, proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockEditorDialog({
  block,
  open,
  onClose,
  onSave,
  isSaving,
}: {
  block: PromptBlock | null;
  open: boolean;
  onClose: () => void;
  onSave: (blockId: string, content: string, commitMessage: string) => void;
  isSaving: boolean;
}) {
  const blockKey = block?.id || "";
  const [content, setContent] = useState(block?.content || "");
  const [commitMessage, setCommitMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [prevKey, setPrevKey] = useState(blockKey);
  if (blockKey !== prevKey) {
    setPrevKey(blockKey);
    if (block) {
      setContent(block.content);
      setCommitMessage("");
      setShowPreview(false);
    }
  }

  if (!block) return null;

  const tierConfig = TIER_CONFIG[block.tier];

  const handleSave = () => {
    if (!commitMessage.trim()) return;
    onSave(block.id, content, commitMessage);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Block: {block.name}
          </DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            <TierBadge tier={block.tier} />
            <span className="text-sm text-slate-500">{block.description}</span>
          </div>
        </DialogHeader>

        {block.tier <= 2 && (
          <div className={cn(
            "p-3 rounded-lg border text-sm",
            tierConfig.bgColor,
            tierConfig.borderColor
          )}>
            <div className={cn("flex items-center gap-2 font-medium", tierConfig.color)}>
              {block.tier === 1 ? <Lock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {block.tier === 1 ? "Locked Block" : "Caution Block"}
            </div>
            <p className="mt-1 text-slate-600">
              {block.tier === 1
                ? "This is a core system block. Changes may break functionality. Edit carefully."
                : "This block is important for accuracy. Test your changes thoroughly."}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 min-h-0">
          <div className="flex-1 min-h-[250px] relative">
            {showPreview ? (
              <div className="h-full overflow-auto p-4 bg-slate-50 rounded-lg border">
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono">
                  {content}
                </pre>
              </div>
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-full min-h-[250px] font-mono text-sm resize-none"
                placeholder="Enter block content..."
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? "Edit" : "Preview"}
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Commit message <span className="text-red-500">*</span>
            </label>
            <Input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe what you changed and why..."
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !commitMessage.trim()}
            variant={block.tier === 1 ? "destructive" : "default"}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockHistoryDialog({
  block,
  open,
  onClose,
  onRollback,
}: {
  block: PromptBlock | null;
  open: boolean;
  onClose: () => void;
  onRollback: (version: number) => void;
}) {
  const { data, isLoading } = useApiQuery<{
    versions: VersionEntry[];
    currentVersion: number;
  }>({
    url: `/api/admin/prompts/${block?.id}/versions`,
    queryKey: ["block-versions", block?.id],
    enabled: !!block && open,
  });

  if (!block) return null;

  const versions = data?.versions || [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History: {block.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 overflow-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No version history available.</p>
              <p className="text-sm">History is tracked when you edit blocks.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions
                .slice()
                .reverse()
                .map((version, index) => (
                  <div
                    key={version.version}
                    className={cn(
                      "p-4 rounded-lg border",
                      index === 0 ? "bg-blue-50 border-blue-200" : "bg-white"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">Version {version.version}</span>
                          {index === 0 && (
                            <Badge className="text-xs">Current</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{version.commitMessage}</p>
                        <p className="text-xs text-slate-400">
                          {version.changedBy} • {new Date(version.changedAt).toLocaleString()}
                        </p>
                      </div>
                      {index !== 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRollback(version.version)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                    {version.diff && (
                      <pre className="mt-3 p-2 bg-slate-100 rounded text-xs overflow-auto max-h-32 font-mono">
                        {version.diff}
                      </pre>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function PromptRegistryContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "compositions"
  );
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [expandedCompositions, setExpandedCompositions] = useState<Set<string>>(new Set());

  // Block editor state
  const [editingBlock, setEditingBlock] = useState<PromptBlock | null>(null);
  const [showTierWarning, setShowTierWarning] = useState(false);
  const [pendingEditBlock, setPendingEditBlock] = useState<PromptBlock | null>(null);
  const [historyBlock, setHistoryBlock] = useState<PromptBlock | null>(null);

  // Fetch prompts metadata
  const {
    data: promptsData,
    refetch,
  } = useApiQuery<{
    prompts: ManagedPrompt[];
    meta: { total: number; bySource: Record<string, number>; byType: Record<string, number>; withOverrides: number };
  }>({
    url: "/api/admin/prompts",
    queryKey: ["admin-prompts"],
  });

  // Block update mutation
  const updateBlockMutation = useApiMutation<
    ManagedPrompt,
    { content: string; commitMessage: string }
  >({
    url: () => `/api/admin/prompts/${editingBlock?.id}`,
    method: "PUT",
    onSuccess: () => {
      setEditingBlock(null);
      refetch();
    },
  });

  // Rollback mutation
  const rollbackMutation = useApiMutation<
    { message: string },
    { targetVersion: number }
  >({
    url: () => `/api/admin/prompts/${historyBlock?.id}/versions`,
    method: "POST",
    onSuccess: () => {
      setHistoryBlock(null);
      refetch();
    },
  });

  const meta = promptsData?.meta;

  // Get compositions with resolved blocks
  const compositions = useMemo(
    () =>
      allCompositions.map((comp) => {
        const resolvedBlocks = comp.blockIds
          .map((id) => coreBlocks.find((b) => b.id === id))
          .filter((block): block is PromptBlock => block !== undefined);
        const missingBlocks = comp.blockIds.filter(
          (id) => !coreBlocks.find((b) => b.id === id)
        );
        return {
          ...comp,
          blocks: resolvedBlocks,
          missingBlocks,
        };
      }),
    []
  );

  // Group compositions by category
  const compositionsByCategory = useMemo(() => {
    const groups: Record<CompositionCategory, typeof compositions> = {
      chat_rfp: [],
      skills: [],
      foundational: [],
      slack_bots: [],
      customer_views: [],
      contract: [],
      utility: [],
      collateral: [],
    };

    for (const comp of compositions) {
      const category = comp.category || 'utility';
      groups[category].push(comp);
    }

    return groups;
  }, [compositions]);

  const categoryOrder: CompositionCategory[] = [
    'chat_rfp',
    'skills',
    'foundational',
    'slack_bots',
    'customer_views',
    'contract',
    'utility',
  ];

  // Filter blocks for the blocks tab
  const filteredBlocks = useMemo(() => {
    let filtered = [...coreBlocks];

    if (tierFilter !== "all") {
      filtered = filtered.filter((b) => b.tier === tierFilter);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(searchLower) ||
          b.id.toLowerCase().includes(searchLower) ||
          b.description?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [tierFilter, search]);

  // Build assembled prompt text
  const buildAssembledPrompt = (composition: (typeof compositions)[0]): string => {
    const parts: string[] = [];

    for (const block of composition.blocks) {
      if (block.content.trim()) {
        parts.push(`## ${block.name}\n\n${block.content}`);
      }
    }

    return parts.join('\n\n');
  };

  // Handle edit with tier warning
  const handleEditBlock = (block: PromptBlock) => {
    if (block.tier <= 2) {
      setPendingEditBlock(block);
      setShowTierWarning(true);
    } else {
      setEditingBlock(block);
    }
  };

  const handleConfirmEdit = () => {
    if (pendingEditBlock) {
      setEditingBlock(pendingEditBlock);
      setPendingEditBlock(null);
    }
    setShowTierWarning(false);
  };

  const handleRollback = (version: number) => {
    rollbackMutation.mutate({ targetVersion: version });
  };

  // Tab change with URL sync
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/v2/prompt-registry?tab=${tab}`, { scroll: false });
  };

  // Check for admin access
  const isAdmin = isUserAdmin(session?.user as SessionUser);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-xl font-bold text-red-600 mb-2">Access Denied</h1>
        <p className="text-slate-500">You need admin permissions to access this page.</p>
        <Link href="/" className="text-blue-500 mt-4">
          Go Home
        </Link>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; count?: number }[] = [
    {
      id: "compositions",
      label: "Compositions",
      count: compositions.length,
    },
    {
      id: "blocks",
      label: "Building Blocks",
      count: coreBlocks.length,
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <Link
          href="/v2/admin"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileCode className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Prompt Registry</h1>
              <p className="text-sm text-slate-500">
                View and edit system prompts with full transparency
              </p>
            </div>
          </div>
          {meta && (
            <div className="text-sm text-slate-500">
              {compositions.length} compositions • {coreBlocks.length} blocks
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-xs rounded",
                    activeTab === tab.id ? "bg-primary-foreground/20" : "bg-slate-200"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters - Only for blocks tab */}
      {activeTab === "blocks" && (
        <div className="flex-shrink-0 bg-white border-b px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search blocks..."
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">Tier:</span>
              {(["all", 1, 2, 3] as TierFilter[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded transition-colors",
                    tierFilter === tier
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {tier === "all" ? "All" : TIER_CONFIG[tier].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "compositions" ? (
          // Compositions view grouped by category
          <div className="space-y-8">
            {categoryOrder.map((category) => {
              const categoryCompositions = compositionsByCategory[category];
              if (categoryCompositions.length === 0) return null;

              const categoryConfig = COMPOSITION_CATEGORY_CONFIG[category];

              return (
                <div key={category}>
                  <div className="flex items-center gap-3 mb-4">
                    <CategoryBadge category={category} />
                    <h2 className="text-lg font-semibold text-slate-800">
                      {categoryConfig.label}
                    </h2>
                    <span className="text-sm text-slate-500">
                      {categoryCompositions.length} composition{categoryCompositions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{categoryConfig.description}</p>

                  <div className="space-y-4">
                    {categoryCompositions.map((composition) => {
                      const isExpanded = expandedCompositions.has(composition.context);
                      const toggleExpanded = () => {
                        const newSet = new Set(expandedCompositions);
                        if (isExpanded) {
                          newSet.delete(composition.context);
                        } else {
                          newSet.add(composition.context);
                        }
                        setExpandedCompositions(newSet);
                      };

                      const assembledPrompt = buildAssembledPrompt(composition);

                      return (
                        <div
                          key={composition.context}
                          className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={toggleExpanded}
                            className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-semibold text-slate-900">{composition.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {composition.blocks.length} blocks • {composition.outputFormat}
                                </Badge>
                                {composition.missingBlocks.length > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {composition.missingBlocks.length} missing
                                  </Badge>
                                )}
                                <TokenCountBadge
                                  tokens={composition.blocks.reduce((sum, b) => sum + estimateTokens(b.content), 0)}
                                  size="sm"
                                />
                              </div>
                              <p className="text-sm text-slate-600 mb-2">{composition.description}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium">Used by:</span>
                                <UsedByIndicator usedBy={composition.usedBy} />
                              </div>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-5 w-5 text-slate-400 flex-shrink-0 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-200 bg-slate-50 p-4">
                              {composition.missingBlocks.length > 0 && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    Missing Blocks
                                  </div>
                                  <p className="text-sm text-red-600">
                                    The following blocks are referenced but not defined:
                                  </p>
                                  <ul className="mt-2 space-y-1">
                                    {composition.missingBlocks.map((blockId) => (
                                      <li key={blockId} className="text-sm text-red-600 font-mono">
                                        • {blockId}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-sm font-medium text-slate-900">Assembled Prompt:</h4>
                                  <TokenCountBadge tokens={estimateTokens(assembledPrompt)} size="sm" />
                                </div>
                                <pre className="text-xs bg-white border border-slate-200 p-3 rounded overflow-auto max-h-96 text-slate-700 font-mono whitespace-pre-wrap break-words leading-relaxed">
                                  {assembledPrompt}
                                </pre>
                              </div>

                              <div className="space-y-3">
                                <h4 className="text-sm font-medium text-slate-900">Block Breakdown:</h4>
                                {composition.blocks.length === 0 ? (
                                  <p className="text-sm text-slate-500">No blocks in this composition</p>
                                ) : (
                                  composition.blocks.map((block) => (
                                    <div
                                      key={block.id}
                                      className="bg-white border border-slate-200 rounded p-3 group"
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1">
                                          <h5 className="font-medium text-slate-900 text-sm">{block.name}</h5>
                                          <p className="text-xs text-slate-500 mt-0.5">{block.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <TierBadge tier={block.tier} />
                                          <TokenCountBadge tokens={estimateTokens(block.content)} size="sm" />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditBlock(block);
                                            }}
                                          >
                                            <Edit3 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </div>
                                      <pre className="text-xs bg-slate-100 p-2 rounded overflow-auto max-h-32 text-slate-700 font-mono whitespace-pre-wrap break-words">
                                        {block.content}
                                      </pre>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Blocks view - all blocks in a grid
          <div>
            {filteredBlocks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No blocks found</p>
                {search && (
                  <button onClick={() => setSearch("")} className="text-blue-500 mt-2">
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="group p-4 rounded-lg border bg-white hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleEditBlock(block)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-800 truncate">{block.name}</h3>
                        </div>
                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">{block.description}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <TierBadge tier={block.tier} />
                          <TokenCountBadge tokens={estimateTokens(block.content)} size="sm" />
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryBlock(block);
                          }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <TierWarningDialog
        open={showTierWarning}
        tier={(pendingEditBlock?.tier as 1 | 2) || 2}
        blockName={pendingEditBlock?.name || ""}
        onConfirm={handleConfirmEdit}
        onCancel={() => {
          setShowTierWarning(false);
          setPendingEditBlock(null);
        }}
      />

      <BlockEditorDialog
        block={editingBlock}
        open={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={(blockId, content, commitMessage) => {
          updateBlockMutation.mutate({ content, commitMessage });
        }}
        isSaving={updateBlockMutation.isPending}
      />

      <BlockHistoryDialog
        block={historyBlock}
        open={!!historyBlock}
        onClose={() => setHistoryBlock(null)}
        onRollback={handleRollback}
      />
    </div>
  );
}

export default function PromptRegistryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <PromptRegistryContent />
    </Suspense>
  );
}
