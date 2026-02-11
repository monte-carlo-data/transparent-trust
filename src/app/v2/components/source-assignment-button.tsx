'use client';

/**
 * Source Assignment Button
 *
 * Client component for assigning sources to blocks with loading/error states
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { assignSourceToBlock } from '@/lib/v2/assignments/assignment-service';

interface SourceAssignmentButtonProps {
  stagedSourceId: string;
  blockId: string;
  blockTitle?: string;
  onSuccess?: () => void;
  disabled?: boolean;
}

export function SourceAssignmentButton({
  stagedSourceId,
  blockId,
  onSuccess,
  disabled = false,
}: SourceAssignmentButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsLoading(true);
    setError(null);

    try {
      await assignSourceToBlock({
        stagedSourceId,
        blockId,
      });

      // Refresh the page to reflect the assignment changes
      // This ensures pending sources are removed from the list
      router.refresh();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign source';
      setError(message);
      console.error('Assignment error:', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleAssign}
        disabled={disabled || isLoading}
        className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400 mt-2 font-medium"
      >
        {isLoading ? 'Assigning...' : 'Assign to this skill'}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}
