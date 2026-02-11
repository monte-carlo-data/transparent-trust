"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { KnowledgeBar } from "@/components/knowledge-bar";
import TransparencyModal from "@/components/TransparencyModal";
import { Bot, MessageSquare, Plus, Trash2 } from "lucide-react";
import { type InstructionPreset } from "@/components/v2/config";
import { useSettingsStore } from "@/stores/settings-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useChatSession } from "@/hooks/use-chat-session";
import { ConversationalLayout } from "@/components/v2/conversational-layout";
import type { Message } from "@/components/v2/conversational-layout";
import { toast } from "sonner";
import type { Customer } from "@/types/v2";

export default function ChatPage() {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [showTransparency, setShowTransparency] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [availableBlocks, setAvailableBlocks] = useState<Array<{ id: string; title: string; content: string; libraryId: string; blockType?: string; entryType?: string }>>([]);
  const [transparencyMessageId, setTransparencyMessageId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<InstructionPreset | null>(null);

  // Get state from stores
  const modelSpeed = useSettingsStore((state) => state.modelSpeed);
  const callMode = useSettingsStore((state) => state.callMode);
  const webSearchEnabled = useSettingsStore((state) => state.webSearchEnabled);
  const selectedPresetId = useSettingsStore((state) => state.selectedPresetId);
  const userInstructions = useSettingsStore((state) => state.userInstructions);
  const setSettingsModelSpeed = useSettingsStore((state) => state.setModelSpeed);
  const setSettingsCallMode = useSettingsStore((state) => state.setCallMode);
  const setSettingsWebSearchEnabled = useSettingsStore((state) => state.setWebSearchEnabled);
  const setSettingsPresetId = useSettingsStore((state) => state.setSelectedPresetId);
  const setSettingsUserInstructions = useSettingsStore((state) => state.setUserInstructions);

  // Select raw maps to avoid creating new arrays on every render
  const skillSelections = useSelectionStore((state) => state.skillSelections);
  const documentSelections = useSelectionStore((state) => state.documentSelections);
  const urlSelections = useSelectionStore((state) => state.urlSelections);

  // Compute derived values with useMemo
  const selectedBlockIds = useMemo(() => {
    const ids: string[] = [];
    skillSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    documentSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    urlSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    return ids;
  }, [skillSelections, documentSelections, urlSelections]);

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

  // Get session management from custom hook
  const {
    sessionId,
    sessionCustomerId,
    messages,
    sessions,
    isSendingMessage,
    sendMessage,
    createSession,
    loadSession,
    deleteSession,
    loadSessions,
    clearSession,
  } = useChatSession();

  // Sync selectedCustomerId with session's customer when session loads
  useEffect(() => {
    if (sessionCustomerId !== null) {
      setSelectedCustomerId(sessionCustomerId);
    }
  }, [sessionCustomerId]);

  // Load blocks and customers on mount
  useEffect(() => {
    if (!session?.user) return;
    const loadBlocks = async () => {
      try {
        const response = await fetch("/api/v2/blocks?libraryId=knowledge&status=ACTIVE&limit=200&orderBy=title&orderDir=asc");
        if (!response.ok) return;
        const data = await response.json();
        setAvailableBlocks(data.blocks || []);
      } catch (error) {
        console.error("Failed to load blocks:", error);
      }
    };
    loadBlocks();
  }, [session]);

  // Load customers
  useEffect(() => {
    const loadCustomers = async () => {
      setCustomersLoading(true);
      try {
        const response = await fetch("/api/v2/customers");
        if (response.ok) {
          const data = await response.json();
          setCustomers(data.customers || []);
        }
      } catch (error) {
        console.error("Failed to load customers:", error);
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, []);

  // Load sessions on mount
  useEffect(() => {
    if (session?.user) {
      loadSessions();
    }
  }, [session, loadSessions]);

  const startNewChat = () => {
    clearSession();
    setSelectedCustomerId(null);
    useSelectionStore.setState({
      skillSelections: new Map(),
      documentSelections: new Map(),
      urlSelections: new Map(),
      customerSelections: new Map(),
    });
  };

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
          sessionType: 'chat',
        });
      }
      await sendMessage(messageText);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
    }
  }, [isSendingMessage, sessionId, selectedCustomerId, createSession, sendMessage]);

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
          title: "Chat History",
          icon: MessageSquare,
          content: (
            <>
              {sessions.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto opacity-30" />
                    <p className="text-xs">No chat history</p>
                    <p className="text-xs opacity-70">Start a new chat to begin</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all hover:bg-accent ${
                        sessionId === s.id ? "bg-accent" : ""
                      }`}
                      onClick={() => loadSession(s.id)}
                    >
                      <div className="flex items-center gap-2 truncate flex-1">
                        <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{s.title}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 opacity-0 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(s.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ),
          footer: (
            <div className="p-4 border-t bg-muted/30">
              <Button size="sm" variant="ghost" onClick={startNewChat} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>
          ),
          storageKey: "chat-v2-history-width",
          defaultWidth: 320,
          minWidth: 280,
          maxWidth: 400,
          defaultOpen: false,
        }}
        rightSidebar={{
          title: "Knowledge Context",
          content: (
            <KnowledgeBar
              selectedPersona={selectedPersona}
              selectedCustomerId={selectedCustomerId}
            />
          ),
          storageKey: "chat-v2-knowledge-width",
          defaultWidth: 360,
          minWidth: 280,
          maxWidth: 500,
          defaultOpen: false,
        }}
        controlBar={{
          leftContent: (
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={startNewChat}
                className="gap-2"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </Button>
              {sessionId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startNewChat}
                  className="text-destructive hover:text-destructive"
                >
                  End Chat
                </Button>
              )}
            </div>
          ),
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
          customerDisabledReason: "Customer is locked for this session. Start a new chat to change customer.",
        }}
        messages={layoutMessages}
        sessionId={sessionId}
        onSendMessage={handleSendMessage}
        isSendingMessage={isSendingMessage}
        emptyState={{
          icon: Bot,
          title: "Start a conversation",
          description: "Select knowledge sources from the sidebar, then ask a question",
        }}
        statusBar={{
          selectedSkillCount,
          selectedDocCount,
          selectedUrlCount,
          modelSpeed,
          isLoading: isSendingMessage,
          onCustomize: () => {},
          onPreviewPrompt: () => setShowPromptPreview(true),
          selectedCustomerName: selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.company ?? null : null,
        }}
        input={{
          value: input,
          onChange: setInput,
          placeholder: "Type your message...",
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

      {/* Message Transparency Modal */}
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

      {/* Prompt Preview Modal */}
      <TransparencyModal
        open={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        title="Prompt Preview"
        subtitle="Current configuration that will be used for the next message"
        headerColor="blue"
        configs={[
          { label: "Model", value: modelSpeed === "fast" ? "Haiku (Fast)" : "Sonnet (Quality)", color: "blue" },
          { label: "Call Mode", value: callMode ? "On" : "Off", color: callMode ? "yellow" : "purple" },
          { label: "Web Search", value: webSearchEnabled ? "Enabled" : "Disabled", color: webSearchEnabled ? "green" : "purple" },
        ]}
        systemPrompt={userInstructions || "Default assistant instructions (no custom persona selected)"}
        sections={
          selectedBlockIds.length > 0
            ? [
                {
                  id: "selected-blocks",
                  title: `Selected Context (${selectedBlockIds.length} blocks)`,
                  content: availableBlocks
                    .filter((b) => selectedBlockIds.includes(b.id))
                    .map((b) => `• ${b.title} (${b.libraryId})`)
                    .join("\n") || "No blocks selected",
                  defaultExpanded: true,
                  maxHeight: 240,
                },
              ]
            : [
                {
                  id: "no-blocks",
                  title: "Selected Context",
                  content: "No knowledge blocks selected. Select skills, documents, or URLs from the Knowledge sidebar to provide context for the AI.",
                  defaultExpanded: true,
                  maxHeight: 160,
                },
              ]
        }
      />
    </div>
  );
}
