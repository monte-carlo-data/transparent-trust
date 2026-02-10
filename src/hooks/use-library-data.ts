import { useState, useEffect } from 'react';
import type { LibraryId } from '@/types/v2/building-block';

interface BuildingBlock {
  id: string;
  title: string;
  libraryId: LibraryId;
  categories?: string[];
  entryType?: string | null;
  content?: string;
  customerId?: string | null;
}

interface UseLibraryDataReturn {
  skills: BuildingBlock[];
  documents: BuildingBlock[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLibraryData(
  libraryId: LibraryId,
  enabled: boolean
): UseLibraryDataReturn {
  const [skills, setSkills] = useState<BuildingBlock[]>([]);
  const [documents, setDocuments] = useState<BuildingBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v2/blocks?libraryId=${libraryId}&status=ACTIVE&limit=200&orderBy=title&orderDir=asc`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${libraryId} library data`);
      }

      const data = await response.json();
      const blocks = data.blocks || [];

      // Separate skills and documents
      const skillBlocks = blocks.filter((b: BuildingBlock) => b.entryType !== 'document');
      const documentBlocks = blocks.filter((b: BuildingBlock) => b.entryType === 'document');

      // Debug: log sample block structure
      if (skillBlocks.length > 0) {
        console.log(`[${libraryId}] Sample skill block:`, {
          id: skillBlocks[0].id,
          title: skillBlocks[0].title,
          categories: skillBlocks[0].categories,
          slug: skillBlocks[0].slug,
        });
      }

      setSkills(skillBlocks);
      setDocuments(documentBlocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSkills([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryId, enabled]);

  return {
    skills,
    documents,
    loading,
    error,
    refetch: fetchData,
  };
}
