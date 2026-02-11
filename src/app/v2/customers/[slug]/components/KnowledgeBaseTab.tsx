'use client';

/**
 * KnowledgeBaseTab - Customer-scoped library using UnifiedLibraryClient
 *
 * This is a thin wrapper that passes customer context to the unified component.
 */

import { UnifiedLibraryClient } from '@/components/v2/UnifiedLibraryClient';
import type { StagedSourceItem } from '@/components/v2/UnifiedLibraryClient';

interface Customer {
  id: string;
  title: string;
}

interface Skill {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  attributes: unknown;
  status: string;
  updatedAt?: Date;
}

interface KnowledgeBaseTabProps {
  customerSlug: string;
  customer: Customer;
  customerSkills: Skill[];
  sourcesByType: {
    url?: StagedSourceItem[];
    document?: StagedSourceItem[];
    slack?: StagedSourceItem[];
    gong?: StagedSourceItem[];
  };
  totalSkills: number;
}

export function KnowledgeBaseTab({
  customerSlug,
  customer,
  customerSkills,
  sourcesByType,
  totalSkills,
}: KnowledgeBaseTabProps) {
  return (
    <UnifiedLibraryClient
      libraryId="customers"
      skills={customerSkills as Array<typeof customerSkills[0] & { updatedAt: Date }>}
      totalSkills={totalSkills}
      pendingReview={0}
      activeSkills={totalSkills}
      sourcesByType={sourcesByType}
      customerId={customer.id}
      customerSlug={customerSlug}
      embedded={true}
    />
  );
}
