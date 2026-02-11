"use client";

import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  email?: string;
}

interface RequestReviewDialogProps {
  isOpen: boolean;
  questionId: string;
  onClose: () => void;
  onSubmit: (reviewerIds: string[], note: string) => Promise<void>;
  availableReviewers?: User[];
  isLoading?: boolean;
}

export function RequestReviewDialog({
  isOpen,
  onClose,
  onSubmit,
  availableReviewers = [],
}: RequestReviewDialogProps) {
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedReviewers([]);
      setNote("");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedReviewers.length === 0) {
      setError("Please select at least one reviewer");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(selectedReviewers, note);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to request review"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Request Review
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Reviewers Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Reviewers
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50">
              {availableReviewers.length === 0 ? (
                <p className="text-sm text-slate-500">No reviewers available</p>
              ) : (
                availableReviewers.map((reviewer) => (
                  <label
                    key={reviewer.id}
                    className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedReviewers.includes(reviewer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReviewers((prev) => [
                            ...prev,
                            reviewer.id,
                          ]);
                        } else {
                          setSelectedReviewers((prev) =>
                            prev.filter((id) => id !== reviewer.id)
                          );
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {reviewer.name}
                      </p>
                      {reviewer.email && (
                        <p className="text-xs text-slate-500">
                          {reviewer.email}
                        </p>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Note (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any context or specific areas you'd like reviewed..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 rounded-md font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedReviewers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
