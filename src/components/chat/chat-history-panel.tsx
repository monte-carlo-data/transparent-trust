"use client";

import { useState } from "react";
import { Trash2, MessageSquare } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmModal";
import { ChatSessionItem } from "@/hooks/use-chat-session";

interface ChatHistoryPanelProps {
  sessions: ChatSessionItem[];
  currentSessionId: string | null;
  isLoading: boolean;
  onLoadSession: (session: ChatSessionItem) => void;
  onDeleteSession: (id: string) => void;
  onClose: () => void;
}

export function ChatHistoryPanel({
  sessions,
  currentSessionId,
  isLoading,
  onLoadSession,
  onDeleteSession,
  onClose,
}: ChatHistoryPanelProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm({
    title: "Delete Chat Session",
    message: "Are you sure you want to delete this chat session? This action cannot be undone.",
    variant: "danger",
  });

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm();
    if (confirmed) {
      setDeletingId(id);
      onDeleteSession(id);
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg bg-background border">
        <CardContent className="py-8 flex items-center justify-center">
          <InlineLoader size="md" className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-lg max-h-80 overflow-hidden bg-background border">
        <CardHeader className="py-3 px-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Chat History</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-64 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No chat history yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onLoadSession(session)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors text-foreground",
                    currentSessionId === session.id && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm text-foreground truncate max-w-full">{session.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{formatDate(session.updatedAt)}</span>
                        <span>• {session.messageCount} messages</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(session.id, e)}
                    disabled={deletingId === session.id}
                  >
                    {deletingId === session.id ? (
                      <InlineLoader size="sm" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </>
  );
}
