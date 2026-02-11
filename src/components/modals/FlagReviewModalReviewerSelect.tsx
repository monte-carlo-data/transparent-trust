"use client";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
}

interface FlagReviewModalReviewerSelectProps {
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  users: User[];
  isLoading: boolean;
  action: "flag" | "need-help";
}

export function FlagReviewModalReviewerSelect({
  selectedUserId,
  onUserChange,
  users,
  isLoading,
  action,
}: FlagReviewModalReviewerSelectProps) {
  // Only show for "need-help" action
  if (action !== "need-help") {
    return null;
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Assign to reviewer (optional)
      </label>
      <select
        value={selectedUserId}
        onChange={(e) => onUserChange(e.target.value)}
        disabled={isLoading}
        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
      >
        <option value="">Anyone can review</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name || user.email || "Unknown user"}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-400 mt-1.5">
        Leave blank to allow anyone to review, or select a specific person.
      </p>
    </div>
  );
}
