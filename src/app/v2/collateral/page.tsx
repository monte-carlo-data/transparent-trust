"use client";

/**
 * V2 Collateral Builder Page
 *
 * Conversational collateral generation using templates and customer context.
 * Uses shared ConversationalLayout component.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { KnowledgeBar } from "@/components/knowledge-bar";
import TransparencyModal from "@/components/TransparencyModal";
import {
  FileText,
  Copy,
  Download,
  Check,
  Presentation,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { type InstructionPreset } from "@/components/v2/config";
import { useSettingsStore } from "@/stores/settings-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useChatSession } from "@/hooks/use-chat-session";
import { useApiQuery } from "@/hooks/use-api";
import { ConversationalLayout } from "@/components/v2/conversational-layout";
import type { Message } from "@/components/v2/conversational-layout";
import { toast } from "sonner";
import type { Customer, TemplateAttributes } from "@/types/v2";

type Template = {
  id: string;
  title: string;
  slug: string | null;
  content: string;
  summary: string | null;
  attributes: TemplateAttributes | null;
};

export default function CollateralPage() {
  useSession(); // Ensure user is authenticated
  const [input, setInput] = useState("");
  const [showTransparency, setShowTransparency] = useState(false);
  const [transparencyMessageId, setTransparencyMessageId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<InstructionPreset | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExportingSlides, setIsExportingSlides] = useState(false);
  const [slidesExportResult, setSlidesExportResult] = useState<{ presentationId: string; webViewLink: string } | null>(null);

  // Get state from stores
  const modelSpeed = useSettingsStore((state) => state.modelSpeed);
  const callMode = useSettingsStore((state) => state.callMode);
  const webSearchEnabled = useSettingsStore((state) => state.webSearchEnabled);
  const selectedPresetId = useSettingsStore((state) => state.selectedPresetId);
  const setSettingsModelSpeed = useSettingsStore((state) => state.setModelSpeed);
  const setSettingsCallMode = useSettingsStore((state) => state.setCallMode);
  const setSettingsWebSearchEnabled = useSettingsStore((state) => state.setWebSearchEnabled);
  const setSettingsPresetId = useSettingsStore((state) => state.setSelectedPresetId);
  const setSettingsUserInstructions = useSettingsStore((state) => state.setUserInstructions);

  // Select raw maps to avoid creating new arrays on every render
  const skillSelections = useSelectionStore((state) => state.skillSelections);
  const documentSelections = useSelectionStore((state) => state.documentSelections);
  const urlSelections = useSelectionStore((state) => state.urlSelections);
  const sourceSelections = useSelectionStore((state) => state.sourceSelections);

  // Compute derived values with useMemo
  const selectedSkillCount = useMemo(() => {
    let count = 0;
    skillSelections.forEach((selected) => { if (selected) count++; });
    return count;
  }, [skillSelections]);

  const selectedDocCount = useMemo(() => {
    let count = 0;
    documentSelections.forEach((selected) => { if (selected) count++; });
    return count;
  }, [documentSelections]);

  const selectedUrlCount = useMemo(() => {
    let count = 0;
    urlSelections.forEach((selected) => { if (selected) count++; });
    return count;
  }, [urlSelections]);

  // Compute selected IDs for API calls
  const selectedBlockIds = useMemo(() => {
    const ids: string[] = [];
    skillSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    documentSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    urlSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    return ids;
  }, [skillSelections, documentSelections, urlSelections]);

  const selectedSourceIds = useMemo(() => {
    const ids: string[] = [];
    sourceSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    return ids;
  }, [sourceSelections]);

  // Get session management from custom hook
  const {
    sessionId,
    sessionCustomerId,
    messages,
    isSendingMessage,
    sendMessage,
    createSession,
    clearSession,
  } = useChatSession();

  // Sync selectedCustomerId with session's customer when session loads
  useEffect(() => {
    if (sessionCustomerId !== null) {
      setSelectedCustomerId(sessionCustomerId);
    }
  }, [sessionCustomerId]);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useApiQuery<Template[]>({
    queryKey: ["v2-collateral-templates"],
    url: "/api/v2/blocks",
    params: { libraryId: "templates", status: "ACTIVE", limit: 50 },
    responseKey: "blocks",
    transform: (data) => (Array.isArray(data) ? data : []),
  });

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true);
      try {
        const response = await fetch("/api/v2/customers");
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || []);
        } else {
          console.error("Failed to load customers:", response.status);
          toast.error("Failed to load customers");
        }
      } catch (error) {
        console.error("Failed to load customers:", error);
        toast.error("Failed to load customers");
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, []);

  // Get the latest assistant message content for export
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const selectedTransparencyMessage = messages.find(
    (message) => message.id === transparencyMessageId
  );
  const selectedTransparency = selectedTransparencyMessage?.transparency;
  const transparencySections = selectedTransparency?.blocksUsed?.length
    ? selectedTransparency.blocksUsed.map((block, index) => ({
        id: block.id,
        title: `Block ${index + 1}: ${block.title}`,
        content: block.content,
        note: `ID: ${block.id} • Type: ${block.blockType}`,
        defaultExpanded: index === 0,
        maxHeight: 240,
      }))
    : selectedTransparency
      ? [
          {
            id: "blocks-empty",
            title: "Blocks Used",
            content: "No blocks were used for this response.",
            defaultExpanded: true,
            maxHeight: 160,
          },
        ]
      : [];

  const handlePresetChange = useCallback((preset: InstructionPreset | null) => {
    setSettingsPresetId(preset?.id || null);
    setSettingsUserInstructions(preset?.content || "");
    setSelectedPersona(preset);
  }, [setSettingsPresetId, setSettingsUserInstructions]);

  const handleUserInstructionsChange = useCallback((instructions: string) => {
    setSettingsUserInstructions(instructions);
  }, [setSettingsUserInstructions]);

  const handleCallModeChange = useCallback((enabled: boolean) => {
    setSettingsCallMode(enabled);
  }, [setSettingsCallMode]);

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isSendingMessage) return;
    try {
      // If no session exists and customer is selected, create session with customer first
      if (!sessionId && selectedCustomerId) {
        await createSession({
          customerId: selectedCustomerId,
          sessionType: 'collateral',
        });
      } else if (!sessionId) {
        // Create collateral session without customer
        await createSession({
          sessionType: 'collateral',
        });
      }
      await sendMessage(messageText);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
    }
  }, [isSendingMessage, sessionId, selectedCustomerId, createSession, sendMessage]);

  const handleGenerateFromTemplate = useCallback(async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }

    // Build the generation prompt
    const customerContext = selectedCustomerId
      ? customers.find((c) => c.id === selectedCustomerId)
      : null;

    let prompt = `Generate collateral using the "${selectedTemplate.title}" template.\n\n`;
    prompt += `Template structure:\n${selectedTemplate.content}\n\n`;

    if (customerContext) {
      prompt += `Customer context: ${customerContext.company}\n`;
    }

    prompt += `Please fill in the template with relevant content based on the selected knowledge context. Make it compelling and professional.`;

    await handleSendMessage(prompt);
  }, [selectedTemplate, selectedCustomerId, customers, handleSendMessage]);

  const handleCopy = async () => {
    if (!latestAssistantMessage?.content) return;
    await navigator.clipboard.writeText(latestAssistantMessage.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleDownloadMarkdown = () => {
    if (!latestAssistantMessage?.content) return;
    const filename = selectedTemplate
      ? `${selectedTemplate.title.toLowerCase().replace(/\s+/g, "-")}.md`
      : "collateral.md";
    const blob = new Blob([latestAssistantMessage.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown");
  };

  const handleExportToSlides = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }

    const attributes = selectedTemplate.attributes;
    // Support both new outputConfig and legacy googleSlidesTemplateId
    const googleSlidesTemplateId =
      attributes?.outputConfig?.['google-slides']?.templateId ||
      attributes?.googleSlidesTemplateId;

    if (attributes?.outputType !== 'google-slides' || !googleSlidesTemplateId) {
      toast.error("This template is not configured for Google Slides export");
      return;
    }

    setIsExportingSlides(true);
    setSlidesExportResult(null);

    // Step 1: Generate placeholder values
    let placeholders: Record<string, string>;
    try {
      const generateResponse = await fetch("/api/v2/collateral/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          blockIds: selectedBlockIds,
          stagedSourceIds: selectedSourceIds,
          customerId: selectedCustomerId || undefined,
        }),
      });

      if (!generateResponse.ok) {
        const error = await generateResponse.json();
        toast.error(error.error || "Failed to generate content");
        setIsExportingSlides(false);
        return;
      }

      const generateData = await generateResponse.json();
      placeholders = generateData.placeholders;

      if (!placeholders || Object.keys(placeholders).length === 0) {
        toast.error("No placeholder values were generated");
        setIsExportingSlides(false);
        return;
      }
    } catch (error) {
      console.error("Content generation failed:", error);
      toast.error("Failed to generate content for placeholders");
      setIsExportingSlides(false);
      return;
    }

    // Step 2: Export to Google Slides
    try {
      const customerName = selectedCustomerId
        ? customers.find((c) => c.id === selectedCustomerId)?.company
        : undefined;
      const copyTitle = customerName
        ? `${selectedTemplate.title} - ${customerName} - ${new Date().toISOString().split('T')[0]}`
        : `${selectedTemplate.title} - ${new Date().toISOString().split('T')[0]}`;

      const exportResponse = await fetch("/api/v2/collateral/export-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templatePresentationId: googleSlidesTemplateId,
          placeholders,
          copyTitle,
        }),
      });

      if (!exportResponse.ok) {
        const error = await exportResponse.json();
        toast.error(error.error || "Failed to export to Google Slides");
        setIsExportingSlides(false);
        return;
      }

      const exportData = await exportResponse.json();
      setSlidesExportResult(exportData);
      toast.success("Exported to Google Slides!");
    } catch (error) {
      console.error("Google Slides export failed:", error);
      toast.error("Failed to export to Google Slides");
    } finally {
      setIsExportingSlides(false);
    }
  };

  const startNewCollateral = () => {
    clearSession();
    setSelectedTemplateId(null);
    setSelectedCustomerId(null);
    setSlidesExportResult(null);
    useSelectionStore.setState({
      skillSelections: new Map(),
      documentSelections: new Map(),
      urlSelections: new Map(),
      customerSelections: new Map(),
      sourceSelections: new Map(),
    });
  };

  // Transform messages to ConversationalLayout format
  const layoutMessages: Message[] = messages.map(msg => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    transparency: msg.transparency ? {
      ...msg.transparency,
      blocksUsed: msg.transparency.blocksUsed?.map(block => ({
        ...block,
        entryType: block.entryType ?? undefined,
      })),
    } : undefined,
    feedback: msg.feedback ? {
      rating: msg.feedback.rating as "THUMBS_UP" | "THUMBS_DOWN" | null,
      comment: msg.feedback.comment ?? undefined,
      flaggedForReview: msg.feedback.flaggedForReview ?? undefined,
      flagNote: msg.feedback.flagNote ?? undefined,
    } : undefined,
  }));

  return (
    <div className="h-[calc(100vh-0px)]">
      <ConversationalLayout
        leftSidebar={{
          title: "Templates",
          icon: FileText,
          content: (
            <>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <InlineLoader size="sm" />
                </div>
              ) : templates.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2 p-4">
                    <FileText className="h-8 w-8 mx-auto opacity-30" />
                    <p className="text-xs">No templates available</p>
                    <p className="text-xs opacity-70">Create templates in Admin</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-medium text-sm truncate">{template.title}</span>
                        </div>
                        {template.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                            {template.summary}
                          </p>
                        )}
                        {template.attributes?.format && (
                          <span className="inline-block mt-1 ml-6 px-2 py-0.5 text-[10px] bg-muted text-muted-foreground rounded uppercase">
                            {template.attributes.format}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ),
          footer: selectedTemplate ? (
            <div className="p-4 border-t bg-muted/30">
              <div className="mb-3 p-3 bg-background rounded-lg border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Selected Template</p>
                <p className="text-sm font-medium">{selectedTemplate.title}</p>
              </div>
              <Button
                className="w-full"
                onClick={handleGenerateFromTemplate}
                disabled={isSendingMessage}
              >
                {isSendingMessage ? (
                  <>
                    <InlineLoader size="sm" className="mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Collateral
                  </>
                )}
              </Button>
            </div>
          ) : undefined,
          storageKey: "collateral-v2-template-width",
          defaultWidth: 340,
          minWidth: 280,
          maxWidth: 450,
          defaultOpen: true,
        }}
        rightSidebar={{
          title: "Knowledge Context",
          content: (
            <KnowledgeBar
              selectedPersona={selectedPersona}
              selectedCustomerId={selectedCustomerId}
            />
          ),
          storageKey: "collateral-v2-knowledge-width",
          defaultWidth: 360,
          minWidth: 280,
          maxWidth: 500,
          defaultOpen: true,
        }}
        controlBar={{
          leftContent: (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={startNewCollateral}
                className="gap-2"
              >
                <FileText className="h-3 w-3" />
                New
              </Button>
            </div>
          ),
          rightContent: latestAssistantMessage ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleCopy} className="gap-2">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadMarkdown} className="gap-2">
                <Download className="h-3 w-3" />
                Download
              </Button>
              {slidesExportResult ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(slidesExportResult.webViewLink, '_blank')}
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Slides
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleExportToSlides}
                  disabled={
                    isExportingSlides ||
                    !selectedTemplate ||
                    selectedTemplate.attributes?.outputType !== 'google-slides'
                  }
                  title={
                    !selectedTemplate
                      ? "Select a template first"
                      : selectedTemplate.attributes?.outputType !== 'google-slides'
                        ? "This template is not configured for Google Slides"
                        : "Export to Google Slides"
                  }
                >
                  {isExportingSlides ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Presentation className="h-3 w-3" />
                      Slides
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : undefined,
          selectedPresetId,
          onPresetChange: handlePresetChange,
          onUserInstructionsChange: handleUserInstructionsChange,
          callMode,
          onCallModeChange: handleCallModeChange,
          customers,
          selectedCustomerId,
          onCustomerSelect: (id) => setSelectedCustomerId(id),
          customersLoading,
          customerDisabled: !!sessionId,
          customerDisabledReason: "Customer is locked for this session. Click 'New' to change customer.",
        }}
        messages={layoutMessages}
        sessionId={sessionId}
        onSendMessage={handleSendMessage}
        isSendingMessage={isSendingMessage}
        emptyState={{
          icon: FileText,
          title: "Create Collateral",
          description: (
            <>
              1. Select a template from the sidebar<br />
              2. Choose customer context and knowledge sources<br />
              3. Click &quot;Generate Collateral&quot; to create content<br />
              4. Refine with follow-up messages
            </>
          ),
        }}
        statusBar={{
          selectedSkillCount,
          selectedDocCount,
          selectedUrlCount,
          modelSpeed,
          isLoading: isSendingMessage,
          onCustomize: () => {},
          selectedCustomerName: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.company ?? null : null,
        }}
        input={{
          value: input,
          onChange: setInput,
          placeholder: messages.length === 0
            ? "Select a template and click Generate, or type a message..."
            : "Refine the collateral (e.g., 'make section 2 more detailed')...",
          disabled: false,
        }}
        settings={{
          modelSpeed,
          setModelSpeed: setSettingsModelSpeed,
          webSearchEnabled,
          setWebSearchEnabled: setSettingsWebSearchEnabled,
        }}
        onViewTransparency={(messageId) => {
          setTransparencyMessageId(messageId);
          setShowTransparency(true);
        }}
      />

      {/* Transparency Modal */}
      {selectedTransparency && (
        <TransparencyModal
          open={showTransparency}
          onClose={() => {
            setShowTransparency(false);
            setTransparencyMessageId(null);
          }}
          title="Transparency"
          subtitle="See the prompt, model, and blocks used for this response"
          headerColor="gray"
          configs={[
            { label: "Composition", value: selectedTransparency.compositionId, color: "purple" },
            { label: "Model", value: selectedTransparency.model, color: "blue" },
            { label: "Prompt Blocks", value: selectedTransparency.blockIds.length, color: "blue" },
            ...(selectedTransparency.runtimeContext?.callMode ? [{ label: "Call Mode", value: "On", color: "yellow" as const }] : []),
            ...(selectedTransparency.runtimeContext?.userInstructions ? [{ label: "Custom Instructions", value: "Yes", color: "green" as const }] : []),
          ]}
          systemPrompt={selectedTransparency.systemPrompt}
          sections={transparencySections}
        />
      )}
    </div>
  );
}
