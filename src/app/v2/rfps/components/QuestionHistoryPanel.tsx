"use client";

type HistoryItem = {
  id: string;
  question: string;
  createdAt: string;
};

type Props = {
  showHistory: boolean;
  setShowHistory: (value: boolean) => void;
  questionHistory: HistoryItem[];
  onLoadHistoryItem?: (id: string) => void;
};

export function QuestionHistoryPanel({ showHistory, setShowHistory, questionHistory, onLoadHistoryItem }: Props) {
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setShowHistory(!showHistory)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-md bg-white hover:bg-slate-50"
      >
        <span>Question History ({questionHistory.length})</span>
        <span>{showHistory ? "▾" : "▸"}</span>
      </button>
      {showHistory && (
        <div className="mt-2 border border-slate-200 rounded-md bg-white max-h-64 overflow-y-auto">
          {questionHistory.length === 0 ? (
            <div className="p-3 text-sm text-slate-500">No recent questions</div>
          ) : (
            questionHistory.map((item) => (
              <button
                key={item.id}
                onClick={() => onLoadHistoryItem?.(item.id)}
                className="w-full text-left px-3 py-2 border-b last:border-b-0 border-slate-100 hover:bg-slate-50"
              >
                <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</p>
                <p className="text-sm text-slate-900 line-clamp-2">{item.question}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
