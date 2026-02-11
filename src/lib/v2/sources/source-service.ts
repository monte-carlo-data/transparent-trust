/**
 * Source Service
 *
 * Client-side utilities for managing staged sources
 */

interface ProcessSourceRequest {
  sourceId: string;
}

interface IgnoreSourceRequest {
  sourceId: string;
}

export async function processSource({
  sourceId,
}: ProcessSourceRequest): Promise<void> {
  const response = await fetch(`/api/v2/sources/${sourceId}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process source');
  }
}

export async function ignoreSource({
  sourceId,
}: IgnoreSourceRequest): Promise<void> {
  const response = await fetch(`/api/v2/sources/${sourceId}/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to ignore source');
  }
}
