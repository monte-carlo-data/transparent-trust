"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useApiQuery } from "@/hooks/use-api";
import { FlagReviewModalHeader } from "@/components/modals/FlagReviewModalHeader";
import { FlagReviewModalActionTabs } from "@/components/modals/FlagReviewModalActionTabs";
import { FlagReviewModalReviewerSelect } from "@/components/modals/FlagReviewModalReviewerSelect";
import { FlagReviewModalNoteInput } from "@/components/modals/FlagReviewModalNoteInput";
import { FlagReviewModalButtons } from "@/components/modals/FlagReviewModalButtons";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

export type FlagReviewAction = "flag" | "need-help";
export type SendTiming = "now" | "later";

export interface FlagReviewData {
  action: FlagReviewAction;
  sendTiming: SendTiming;
  reviewerId?: string;
  reviewerName?: string;
  note: string;
}

interface FlagReviewModalProps {
  isOpen: boolean;
  initialAction?: FlagReviewAction;
  onSubmit: (data: FlagReviewData) => void;
  onCancel: () => void;
  /** Whether this is being used for batch operations (shows "Queue for End" option) */
  allowQueueing?: boolean;
  /** Number of items queued for review (shown in badge) */
  queuedCount?: number;
}

export default function FlagReviewModal(props: FlagReviewModalProps) {
  if (!props.isOpen) {
    return null;
  }
  return <FlagReviewModalContent {...props} />;
}

function FlagReviewModalContent({
  initialAction = "need-help",
  onSubmit,
  onCancel,
  allowQueueing = true,
  queuedCount = 0,
}: Omit<FlagReviewModalProps, "isOpen">) {
  const [action, setAction] = useState<FlagReviewAction>(initialAction);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [note, setNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: usersData, isLoading: loadingUsers } = useApiQuery<{ users: User[] }>({
    queryKey: ["review-users"],
    url: "/api/users",
  });

  const users = usersData?.users ?? [];

  useEffect(() => {
    const timeout = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = (sendTiming: SendTiming) => {
    const selectedUser = users.find((u) => u.id === selectedUserId);
    onSubmit({
      action,
      sendTiming,
      reviewerId: action === "need-help" ? (selectedUserId || undefined) : undefined,
      reviewerName: action === "need-help" && selectedUser
        ? (selectedUser.name || selectedUser.email || undefined)
        : undefined,
      note: note.trim(),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[520px]">
        <FlagReviewModalHeader />

        <div className="space-y-5">
          <FlagReviewModalActionTabs
            action={action}
            onActionChange={setAction}
          />

          <FlagReviewModalReviewerSelect
            selectedUserId={selectedUserId}
            onUserChange={setSelectedUserId}
            users={users}
            isLoading={loadingUsers}
            action={action}
          />

          <FlagReviewModalNoteInput
            ref={textareaRef}
            note={note}
            onNoteChange={setNote}
            action={action}
          />
        </div>

        <FlagReviewModalButtons
          action={action}
          onSubmit={handleSubmit}
          onCancel={onCancel}
          allowQueueing={allowQueueing}
          queuedCount={queuedCount}
        />
      </DialogContent>
    </Dialog>
  );
}

// Hook for easier usage
interface UseFlagReviewReturn {
  openFlagReview: (initialAction?: FlagReviewAction) => Promise<FlagReviewData | null>;
  FlagReviewDialog: React.FC;
  queuedItems: FlagReviewQueueItem[];
  addToQueue: (item: FlagReviewQueueItem) => void;
  clearQueue: () => void;
  processQueue: () => FlagReviewQueueItem[];
}

export interface FlagReviewQueueItem {
  id: string;
  data: FlagReviewData;
}

export function useFlagReview(): UseFlagReviewReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [initialAction, setInitialAction] = useState<FlagReviewAction>("need-help");
  const [queuedItems, setQueuedItems] = useState<FlagReviewQueueItem[]>([]);
  const resolveRef = useRef<((value: FlagReviewData | null) => void) | null>(null);

  const openFlagReview = useCallback(
    (action: FlagReviewAction = "need-help"): Promise<FlagReviewData | null> => {
      setInitialAction(action);
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (data: FlagReviewData) => {
      setIsOpen(false);
      resolveRef.current?.(data);
    },
    []
  );

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const addToQueue = useCallback((item: FlagReviewQueueItem) => {
    setQueuedItems((prev) => [...prev, item]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueuedItems([]);
  }, []);

  const processQueue = useCallback(() => {
    const items = [...queuedItems];
    setQueuedItems([]);
    return items;
  }, [queuedItems]);

  const FlagReviewDialog: React.FC = useCallback(
    () => (
      <FlagReviewModal
        isOpen={isOpen}
        initialAction={initialAction}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        allowQueueing={true}
        queuedCount={queuedItems.length}
      />
    ),
    [isOpen, initialAction, handleSubmit, handleCancel, queuedItems.length]
  );

  return {
    openFlagReview,
    FlagReviewDialog,
    queuedItems,
    addToQueue,
    clearQueue,
    processQueue,
  };
}
