"use client";

import { useState, useMemo } from "react";
import {
  BookOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRight,
  Phone,
  FileCheck,
  Database,
  Loader2,
  StickyNote,
  Mail,
  Calendar,
  BarChart3,
} from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectionStore } from "@/stores/selection-store";
import { KnowledgeLibraryPanel } from "./KnowledgeLibraryPanel";
import type { Skill } from "@/types/skill";
import type { ReferenceUrl } from "@/types/referenceUrl";
import type { TypedBuildingBlock } from "@/types/v2";
import type { CustomerGTMData } from "@/types/gtmData";

/**
 * KnowledgeSidebar - Shared component for knowledge, customer, and GTM context
 *
 * Used by: Chat, Collateral, Projects, Contract Review
 *
 * Features:
 * - Collapsible/expandable sidebar with icon strip when collapsed
 * - Knowledge library selection with category grouping
 * - Customer documents grouped by type (proposals, meeting notes, etc.)
 * - GTM data integration (Gong calls, HubSpot activities, Looker metrics)
 * - Expandable sections for knowledge, customer info, and documents
 */

// Customer document from API
type CustomerDocument = {
  id: string;
  title: string;
  filename: string;
  fileType: string;
  docType: string | null;
  uploadedAt: string;
};

export interface KnowledgeSidebarProps {
  skills: Skill[];
  documents: { id: string; title: string; filename: string }[];
  urls: ReferenceUrl[];
  selectedCustomer: TypedBuildingBlock | null;
  selectedPersonaName?: string | null;
  isLoading?: boolean;
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onCustomizeKnowledge?: () => void;
}

type SectionId = "knowledge" | "customer" | "output";

export function KnowledgeSidebar({
  skills,
  documents,
  urls,
  selectedCustomer,
  selectedPersonaName,
  isLoading,
  isCollapsed: controlledIsCollapsed,
  onCollapsedChange,
  onCustomizeKnowledge,
}: KnowledgeSidebarProps) {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isCollapsed = controlledIsCollapsed !== undefined ? controlledIsCollapsed : internalIsCollapsed;
  const [expandedSections, setExpandedSections] = useState<Record<SectionId, boolean>>({
    knowledge: true,
    customer: true,
    output: false,
  });

  // Toggle collapsed state (no longer persisted - always start expanded to train users)
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newState);
    } else {
      setInternalIsCollapsed(newState);
    }
  };

  const toggleSection = (section: SectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Selection store - only need customer-related selections here
  // Knowledge selections are handled by KnowledgeLibraryPanel
  const {
    customerDocumentSelections,
    toggleCustomerDocument,
    selectAllCustomerDocuments,
    selectNoCustomerDocuments,
  } = useSelectionStore();

  // Fetch customer documents when customer is selected
  const { data: customerDocuments = [], isLoading: docsLoading } = useApiQuery<CustomerDocument[]>({
    queryKey: ["customer-documents", selectedCustomer?.id],
    url: `/api/customers/${selectedCustomer?.id}/documents`,
    responseKey: "documents",
    transform: (data) => (Array.isArray(data) ? data : []),
    enabled: !!selectedCustomer?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Group documents by docType
  const groupedDocs = useMemo(() => {
    const groups: Record<string, CustomerDocument[]> = {
      proposal: [],
      meeting_notes: [],
      requirements: [],
      contract: [],
      other: [],
    };

    customerDocuments.forEach((doc) => {
      const type = doc.docType || "other";
      if (groups[type]) {
        groups[type].push(doc);
      } else {
        groups.other.push(doc);
      }
    });

    return groups;
  }, [customerDocuments]);

  // Fetch GTM data from Snowflake when customer has crmId
  const customerCrmId = selectedCustomer
    ? ((selectedCustomer.attributes as Record<string, unknown>)?.crmId as string | undefined)
    : undefined;

  const {
    data: gtmData,
    isLoading: gtmLoading,
    error: gtmQueryError,
  } = useApiQuery<CustomerGTMData>({
    queryKey: ["gtm-data", customerCrmId],
    url: "/api/snowflake/customer-data",
    params: {
      salesforceAccountId: customerCrmId,
      gongCallLimit: 5,
      hubspotActivityLimit: 10,
    },
    enabled: !!customerCrmId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Derive error message from query error
  const gtmError = gtmQueryError
    ? gtmQueryError.message.includes("503") || gtmQueryError.message.includes("not configured")
      ? "Snowflake not configured"
      : "Failed to load GTM data"
    : null;

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Collapsed view - icon strip
  if (isCollapsed) {
    return (
      <div className="h-full w-12 min-w-[48px] border-l border-border bg-muted/30 flex flex-col items-center py-2 gap-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleCollapsed}>
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Expand sidebar</TooltipContent>
          </Tooltip>

          <div className="w-8 h-px bg-border my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (onCollapsedChange) {
                    onCollapsedChange(false);
                  } else {
                    setInternalIsCollapsed(false);
                  }
                  setExpandedSections((prev) => ({ ...prev, knowledge: true }));
                }}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Knowledge Library</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (onCollapsedChange) {
                    onCollapsedChange(false);
                  } else {
                    setInternalIsCollapsed(false);
                  }
                  setExpandedSections((prev) => ({ ...prev, customer: true }));
                }}
              >
                <Database className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Customer Info & Docs</TooltipContent>
          </Tooltip>

          </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col border-l border-border">
      {/* Header with collapse button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-sm font-medium">Context</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          onClick={toggleCollapsed}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
          Hide
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Section 1: Knowledge Library (Claude Projects style) */}
        <KnowledgeLibraryPanel
          skills={skills}
          documents={documents}
          urls={urls}
          selectedPersonaName={selectedPersonaName || undefined}
          isExpanded={expandedSections.knowledge}
          onExpandedChange={(expanded) =>
            setExpandedSections((prev) => ({ ...prev, knowledge: expanded }))
          }
          onCustomizeClick={onCustomizeKnowledge}
        />

        {/* Section 2: Customer Information & Documents */}
        <Card>
          <CardHeader className="py-2 px-3">
            <button
              onClick={() => toggleSection("customer")}
              className="w-full flex items-center justify-between"
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Customer Info & Docs
                {selectedCustomer && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({selectedCustomer.title})
                  </span>
                )}
              </CardTitle>
              {expandedSections.customer ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          {expandedSections.customer && (
            <CardContent className="py-2 px-3 space-y-3">
              {selectedCustomer ? (
                <>
                  {/* Customer documents */}
                  {docsLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading documents...
                    </div>
                  ) : customerDocuments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      No documents uploaded for this customer
                    </p>
                  ) : (
                    <>
                      {/* Proposals */}
                      {groupedDocs.proposal.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileCheck className="h-3 w-3" />
                              Proposals ({groupedDocs.proposal.length})
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => selectAllCustomerDocuments(groupedDocs.proposal.map(d => d.id))}
                                className="text-[10px] text-primary hover:underline"
                              >
                                All
                              </button>
                              <span className="text-muted-foreground">|</span>
                              <button
                                onClick={() => groupedDocs.proposal.forEach(d => customerDocumentSelections.set(d.id, false))}
                                className="text-[10px] text-primary hover:underline"
                              >
                                None
                              </button>
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.proposal.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={customerDocumentSelections.get(doc.id) || false}
                                  onChange={() => toggleCustomerDocument(doc.id)}
                                  className="h-3 w-3 rounded cursor-pointer"
                                />
                                <span className="text-xs truncate flex-1" title={doc.filename}>
                                  {doc.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meeting Notes */}
                      {groupedDocs.meeting_notes.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <StickyNote className="h-3 w-3" />
                              Meeting Notes ({groupedDocs.meeting_notes.length})
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => selectAllCustomerDocuments(groupedDocs.meeting_notes.map(d => d.id))}
                                className="text-[10px] text-primary hover:underline"
                              >
                                All
                              </button>
                              <span className="text-muted-foreground">|</span>
                              <button
                                onClick={selectNoCustomerDocuments}
                                className="text-[10px] text-primary hover:underline"
                              >
                                None
                              </button>
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.meeting_notes.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={customerDocumentSelections.get(doc.id) || false}
                                  onChange={() => toggleCustomerDocument(doc.id)}
                                  className="h-3 w-3 rounded cursor-pointer"
                                />
                                <span className="text-xs truncate flex-1" title={doc.filename}>
                                  {doc.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Requirements */}
                      {groupedDocs.requirements.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              Requirements ({groupedDocs.requirements.length})
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.requirements.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={customerDocumentSelections.get(doc.id) || false}
                                  onChange={() => toggleCustomerDocument(doc.id)}
                                  className="h-3 w-3 rounded cursor-pointer"
                                />
                                <span className="text-xs truncate flex-1" title={doc.filename}>
                                  {doc.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contracts */}
                      {groupedDocs.contract.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileCheck className="h-3 w-3" />
                              Contracts ({groupedDocs.contract.length})
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.contract.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={customerDocumentSelections.get(doc.id) || false}
                                  onChange={() => toggleCustomerDocument(doc.id)}
                                  className="h-3 w-3 rounded cursor-pointer"
                                />
                                <span className="text-xs truncate flex-1" title={doc.filename}>
                                  {doc.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other */}
                      {groupedDocs.other.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              Other Documents ({groupedDocs.other.length})
                            </div>
                          </div>
                          <div className="space-y-0.5 pl-5">
                            {groupedDocs.other.map((doc) => (
                              <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                                <input
                                  type="checkbox"
                                  checked={customerDocumentSelections.get(doc.id) || false}
                                  onChange={() => toggleCustomerDocument(doc.id)}
                                  className="h-3 w-3 rounded cursor-pointer"
                                />
                                <span className="text-xs truncate flex-1" title={doc.filename}>
                                  {doc.title}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* GTM Data section - Snowflake integration */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Database className="h-3 w-3" />
                      GTM Data (Snowflake)
                    </div>

                    {!customerCrmId ? (
                      <p className="text-xs text-amber-600 pl-5">
                        Not linked to Salesforce. Link to access GTM data.
                      </p>
                    ) : gtmLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading GTM data...
                      </div>
                    ) : gtmError === "Snowflake not configured" ? (
                      <p className="text-xs text-muted-foreground pl-5">
                        Snowflake not configured. Contact admin.
                      </p>
                    ) : gtmError ? (
                      <p className="text-xs text-destructive pl-5">{gtmError}</p>
                    ) : gtmData ? (
                      <div className="space-y-2 pl-2">
                        {/* Gong Calls */}
                        {gtmData.gongCalls.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              Gong Calls ({gtmData.gongCalls.length})
                            </div>
                            <div className="space-y-0.5 pl-5 max-h-20 overflow-y-auto">
                              {gtmData.gongCalls.map((call) => (
                                <TooltipProvider key={call.id} delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-xs truncate cursor-help">
                                        {call.title}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="font-medium">{call.title}</p>
                                      <p className="text-xs text-muted-foreground">{call.date}</p>
                                      {call.summary && (
                                        <p className="text-xs mt-1">{call.summary.slice(0, 200)}...</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* HubSpot Activities */}
                        {gtmData.hubspotActivities.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              HubSpot ({gtmData.hubspotActivities.length})
                            </div>
                            <div className="space-y-0.5 pl-5 max-h-20 overflow-y-auto">
                              {gtmData.hubspotActivities.slice(0, 5).map((activity) => (
                                <div key={activity.id} className="text-xs truncate flex items-center gap-1">
                                  {activity.type === "email" && <Mail className="h-2.5 w-2.5" />}
                                  {activity.type === "call" && <Phone className="h-2.5 w-2.5" />}
                                  {activity.type === "meeting" && <Calendar className="h-2.5 w-2.5" />}
                                  {activity.type === "note" && <StickyNote className="h-2.5 w-2.5" />}
                                  {activity.subject}
                                </div>
                              ))}
                              {gtmData.hubspotActivities.length > 5 && (
                                <span className="text-xs text-muted-foreground">
                                  +{gtmData.hubspotActivities.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Looker Metrics */}
                        {gtmData.lookerMetrics.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <BarChart3 className="h-3 w-3" />
                              Metrics ({gtmData.lookerMetrics.length} periods)
                            </div>
                            <div className="text-xs text-muted-foreground pl-5">
                              Latest: {gtmData.lookerMetrics[0]?.period}
                            </div>
                          </div>
                        )}

                        {gtmData.gongCalls.length === 0 &&
                          gtmData.hubspotActivities.length === 0 &&
                          gtmData.lookerMetrics.length === 0 && (
                            <p className="text-xs text-muted-foreground pl-3">
                              No GTM data found for this customer
                            </p>
                          )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground pl-5">
                        Linked to Salesforce. Loading...
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Select a customer from the Focus Bar to see their documents
                </p>
              )}
            </CardContent>
          )}
        </Card>

        </div>
    </div>
  );
}
