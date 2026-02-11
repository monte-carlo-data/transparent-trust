/**
 * Source Assignment Service
 *
 * Client-side utilities for managing source assignments
 */

export interface AssignmentData {
  stagedSourceId: string;
  blockId: string;
}

export async function assignSourceToBlock(
  data: AssignmentData
): Promise<{ id: string; assignedAt: string }> {
  const response = await fetch('/api/v2/assignments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to assign source');
  }

  return response.json();
}

export async function removeAssignment(
  assignmentId: string
): Promise<{ success: boolean }> {
  const response = await fetch(`/api/v2/assignments/${assignmentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove assignment');
  }

  return response.json();
}

export async function markAsIncorporated(
  assignmentId: string,
  incorporatedAt: Date = new Date()
): Promise<{ incorporatedAt: string; incorporatedBy: string }> {
  const response = await fetch(`/api/v2/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      incorporatedAt: incorporatedAt.toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mark as incorporated');
  }

  return response.json();
}

export async function unmarkAsIncorporated(
  assignmentId: string
): Promise<{ incorporatedAt: null; incorporatedBy: null }> {
  const response = await fetch(`/api/v2/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      incorporatedAt: null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unmark as incorporated');
  }

  return response.json();
}
