"use client";

import { useState, useCallback, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useAutoResizeTextarea } from "@/lib/hooks/useAutoResizeTextarea";
import { ContextSelector } from "@/components/v2/context";
import { CustomerSelector } from "@/components/v2/context/CustomerSelector";
import { UnifiedResponseCard } from "@/components/v2/rfp-responses";
import { QuestionHistoryPanel } from "../components/QuestionHistoryPanel";

interface Question {
  id: string;
  question: string;
  response: string | null;
  confidence: string | null;
  reasoning?: string | null;
  inference?: string | null;
  remarks?: string | null;
  sources?: string[] | null;
  status: string;
  library: string;
  flaggedForReview: boolean;
  reviewStatus: string | null;
  createdAt: string;
}

interface OutputData {
  response?: string | null;
  confidence?: string | null;
  reasoning?: string | null;
  inference?: string | null;
  remarks?: string | null;
  sources?: string[] | null;
}

interface AskResponse {
  success: boolean;
  data?: {
    id: string;
    outputData?: OutputData;
    status: string;
  };
  message?: string;
}

export function AskTab() {
  const [question, setQuestion] = useState("");
  const [library, setLibrary] = useState("skills");
  const [categories, setCategories] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [modelSpeed, setModelSpeed] = useState<"fast" | "quality">("quality");
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-resize textarea
  const questionTextareaRef = useAutoResizeTextarea(question);

  const loadRecentQuestions = useCallback(async () => {
    try {
      const response = await fetch("/api/v2/questions/log?limit=5&source=quick");
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.items) {
          // Transform log items to Question format
          const questions = result.data.items.map((item: Record<string, unknown>) => ({
            id: item.id as string,
            question: item.question as string,
            response: (item.response as string | null) || null,
            confidence: (item.confidence as string | null) || null,
            status: item.status as string,
            library: item.library as string,
            flaggedForReview: (item.flaggedForReview as boolean) || false,
            reviewStatus: (item.reviewStatus as string | null) || null,
            createdAt: item.createdAt as string,
          }));
          setRecentQuestions(questions);
        }
      }
    } catch (err) {
      console.error("Failed to load recent questions:", err);
    }
  }, []);

  // Load question history on mount
  useEffect(() => {
    loadRecentQuestions();
  }, [loadRecentQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v2/questions/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          library,
          categories: categories.length > 0 ? categories : undefined,
          customerId,
          modelSpeed,
        }),
      });

      const result = (await response.json()) as AskResponse;

      if (result.success && result.data) {
        const newQuestion: Question = {
          id: result.data.id,
          question: question.trim(),
          response: result.data.outputData?.response || null,
          confidence: result.data.outputData?.confidence || null,
          reasoning: result.data.outputData?.reasoning || null,
          inference: result.data.outputData?.inference || null,
          remarks: result.data.outputData?.remarks || null,
          sources: result.data.outputData?.sources || null,
          status: result.data.status,
          library,
          flaggedForReview: false,
          reviewStatus: null,
          createdAt: new Date().toISOString(),
        };

        setCurrentQuestion(newQuestion);
        setQuestion("");
        await loadRecentQuestions();
      } else {
        setError(result.message || "Failed to process question");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewUpdate = async (questionId: string, updates: unknown) => {
    try {
      const response = await fetch(`/api/v2/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const result = await response.json();
         if (result.success && result.data?.question) {
          const updatedQ = result.data.question as {
            flaggedForReview?: boolean;
            reviewStatus?: string;
            outputData?: OutputData;
          };
          setCurrentQuestion((prev) =>
            prev && prev.id === questionId
              ? {
                  ...prev,
                  flaggedForReview: updatedQ.flaggedForReview ?? prev.flaggedForReview,
                  reviewStatus: updatedQ.reviewStatus ?? prev.reviewStatus,
                  response: updatedQ.outputData?.response || prev.response,
                  confidence: updatedQ.outputData?.confidence || prev.confidence,
                  reasoning: updatedQ.outputData?.reasoning || prev.reasoning,
                  inference: updatedQ.outputData?.inference || prev.inference,
                  remarks: updatedQ.outputData?.remarks || prev.remarks,
                  sources: updatedQ.outputData?.sources || prev.sources,
                }
              : prev
          );
          await loadRecentQuestions();
        }
      }
    } catch (err) {
      console.error("Failed to update question:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Ask Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Ask a Question
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Question Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Question
              </label>
              <textarea
                ref={questionTextareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                disabled={isLoading}
              />
            </div>

            {/* Context Selector */}
            <ContextSelector
              library={library}
              onLibraryChange={setLibrary}
              categories={categories}
              onCategoriesChange={setCategories}
              questionCount={1}
            />

            {/* Customer Selector */}
            <CustomerSelector
              value={customerId}
              onChange={setCustomerId}
              isLoading={isLoading}
            />

            {/* Speed Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Processing Speed
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModelSpeed("fast")}
                  className={`flex-1 px-3 py-2 rounded-md font-medium transition-colors ${
                    modelSpeed === "fast"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  disabled={isLoading}
                >
                  Fast
                </button>
                <button
                  type="button"
                  onClick={() => setModelSpeed("quality")}
                  className={`flex-1 px-3 py-2 rounded-md font-medium transition-colors ${
                    modelSpeed === "quality"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                  disabled={isLoading}
                >
                  Quality
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium py-2 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Ask
                </>
              )}
            </button>
          </form>
        </div>

        {/* Current Question Response */}
        {currentQuestion && (
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <UnifiedResponseCard
              question={currentQuestion.question}
              response={currentQuestion.response}
              confidence={currentQuestion.confidence}
              status={currentQuestion.status}
              reasoning={currentQuestion.reasoning}
              inference={currentQuestion.inference}
              sources={Array.isArray(currentQuestion.sources)
                ? currentQuestion.sources.join(', ')
                : currentQuestion.sources}
              flaggedForReview={currentQuestion.flaggedForReview}
              reviewStatus={currentQuestion.reviewStatus}
              library={currentQuestion.library}
              onFlag={() =>
                handleReviewUpdate(currentQuestion.id, {
                  flaggedForReview: true,
                })
              }
              onAccept={() =>
                handleReviewUpdate(currentQuestion.id, {
                  reviewStatus: "APPROVED",
                  flaggedForReview: false,  // Unflag when accepting
                })
              }
              allowEditing={false}
              isLoading={false}
            />
          </div>
        )}
      </div>

      {/* Right: History Panel */}
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200 h-fit">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Question History
        </h3>
        <QuestionHistoryPanel
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          questionHistory={recentQuestions}
          onLoadHistoryItem={(id) => {
            const found = recentQuestions.find((q) => q.id === id);
            if (found) {
              setCurrentQuestion(found);
            }
          }}
        />
        <p className="text-xs text-slate-500 mt-2">
          Your knowledge base contains {recentQuestions.length || 0} questions in history.
        </p>
      </div>
    </div>
  );
}

