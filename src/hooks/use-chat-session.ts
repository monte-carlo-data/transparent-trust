import { useState, useCallback, useMemo } from "react";
import { useSelectionStore } from "@/stores/selection-store";
import { useSettingsStore } from "@/stores/settings-store";
import type { ChatMessage } from "@/types/v2/chat";

// Re-export for backward compatibility
export type { ChatMessage };

export interface ChatSessionItem {
  id: string;
  title: string;
  sessionType: string;
  customerId: string | null;
  customer: { id: string; company: string } | null;
  messageCount: number;
  updatedAt: string;
}

export interface CreateSessionOptions {
  customerId?: string | null;
  sessionType?: 'chat' | 'collateral';
  title?: string;
}

export interface UseChatSessionReturn {
  sessionId: string | null;
  sessionCustomerId: string | null;
  messages: ChatMessage[];
  sessions: ChatSessionItem[];
  isLoading: boolean;
  isSendingMessage: boolean;

  // Session management
  createSession: (options?: CreateSessionOptions) => Promise<string>;
  loadSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  clearSession: () => void;

  // Message operations
  sendMessage: (userMessage: string) => Promise<void>;
  updateMessageFeedback: (
    messageId: string,
    feedback: ChatMessage["feedback"]
  ) => Promise<void>;
}

export function useChatSession(): UseChatSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCustomerId, setSessionCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Get selections and settings from stores
  // Note: We select the raw maps to avoid creating new arrays on every render
  const skillSelections = useSelectionStore((state) => state.skillSelections);
  const documentSelections = useSelectionStore((state) => state.documentSelections);
  const urlSelections = useSelectionStore((state) => state.urlSelections);
  const sourceSelections = useSelectionStore((state) => state.sourceSelections);
  const modelSpeed = useSettingsStore((state) => state.modelSpeed);
  const callMode = useSettingsStore((state) => state.callMode);
  const webSearchEnabled = useSettingsStore((state) => state.webSearchEnabled);
  const selectedPresetId = useSettingsStore((state) => state.selectedPresetId);
  const userInstructions = useSettingsStore((state) => state.userInstructions);

  // Compute selectedBlockIds from the maps (memoized to avoid recalculation)
  const selectedBlockIds = useMemo(() => {
    const ids: string[] = [];
    skillSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    documentSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    urlSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    return ids;
  }, [skillSelections, documentSelections, urlSelections]);

  // Compute selectedSourceIds from the source selections map
  const selectedSourceIds = useMemo(() => {
    const ids: string[] = [];
    sourceSelections.forEach((selected, id) => { if (selected) ids.push(id); });
    return ids;
  }, [sourceSelections]);

  // Load available sessions
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v2/chat/sessions");
      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.status}`);
      }
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      // Don't throw - this is a background operation
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load specific session with messages
  const loadSession = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v2/chat/sessions/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }
      const data = await response.json();
      setSessionId(id);
      setSessionCustomerId(data.customerId || null);
      setMessages(
        (data.messages || []).map((msg: { createdAt: string; role: string; content: string }) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        }))
      );
    } catch (error) {
      console.error("Failed to load session:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create new session
  const createSession = useCallback(async (options?: CreateSessionOptions): Promise<string> => {
    try {
      const response = await fetch("/api/v2/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: options?.customerId,
          sessionType: options?.sessionType,
          title: options?.title,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const newSessionId = data.id;
        setSessionId(newSessionId);
        setSessionCustomerId(data.customerId || null);
        setMessages([]);
        await loadSessions();
        return newSessionId;
      }
      throw new Error("Failed to create session");
    } catch (error) {
      console.error("Failed to create session:", error);
      throw error;
    }
  }, [loadSessions]);

  // Clear current session (for starting fresh)
  const clearSession = useCallback(() => {
    setSessionId(null);
    setSessionCustomerId(null);
    setMessages([]);
  }, []);

  // Delete session
  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/v2/chat/sessions/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          throw new Error(`Failed to delete session: ${response.status}`);
        }
        if (sessionId === id) {
          setSessionId(null);
          setSessionCustomerId(null);
          setMessages([]);
        }
        await loadSessions();
      } catch (error) {
        console.error("Failed to delete session:", error);
        throw error;
      }
    },
    [sessionId, loadSessions]
  );

  // Send message
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      setIsSendingMessage(true);
      try {
        // Create session if needed (session should already exist with customer set)
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          currentSessionId = await createSession();
        }

        // Build API payload - use session's customerId
        const payload = {
          message: userMessage,
          sessionId: currentSessionId,
          blockIds: selectedBlockIds,
          stagedSourceIds: selectedSourceIds,
          modelSpeed,
          callMode,
          webSearch: webSearchEnabled,
          presetId: selectedPresetId,
          userInstructions,
          ...(sessionCustomerId && { customerId: sessionCustomerId }),
        };

        // Send message to API
        const response = await fetch("/api/v2/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const data = await response.json();

          // Add user message
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: userMessage,
            createdAt: new Date(),
          };

          // Add assistant message with response data
          const assistantMsg: ChatMessage = {
            id: data.messageId || `assistant-${Date.now()}`,
            role: "assistant",
            content: data.answer,
            blocksUsed: data.blocksUsed,
            sourcesUsed: data.sourcesUsed,
            webSearchSources: data.webSearchSources,
            transparency: data.transparency,
            createdAt: new Date(),
          };

          // Update session and messages
          setSessionId(data.sessionId);
          setMessages((prev) => [...prev, userMsg, assistantMsg]);
          await loadSessions();
        } else {
          const error = await response.json();
          throw new Error(error.error || "Failed to send message");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      sessionId,
      sessionCustomerId,
      selectedBlockIds,
      selectedSourceIds,
      modelSpeed,
      callMode,
      webSearchEnabled,
      selectedPresetId,
      userInstructions,
      createSession,
      loadSessions,
    ]
  );

  // Update message feedback
  const updateMessageFeedback = useCallback(
    async (messageId: string, feedback: ChatMessage["feedback"]) => {
      if (!sessionId) return;

      try {
        const response = await fetch("/api/v2/chat/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId,
            sessionId,
            rating: feedback?.rating,
            comment: feedback?.comment,
            flaggedForReview: feedback?.flaggedForReview,
            flagNote: feedback?.flagNote,
          }),
        });

        if (response.ok) {
          // Update local message feedback
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, feedback } : msg
            )
          );
        }
      } catch (error) {
        console.error("Failed to update feedback:", error);
        throw error;
      }
    },
    [sessionId]
  );

  return {
    sessionId,
    sessionCustomerId,
    messages,
    sessions,
    isLoading,
    isSendingMessage,
    createSession,
    loadSession,
    deleteSession,
    loadSessions,
    clearSession,
    sendMessage,
    updateMessageFeedback,
  };
}
