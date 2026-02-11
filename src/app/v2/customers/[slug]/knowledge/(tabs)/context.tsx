'use client';

/**
 * Customer Knowledge Base Context
 *
 * Provides customer-scoped knowledge base data to all tab routes.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { StagedSourceItem } from '@/components/v2/UnifiedLibraryClient';

interface Skill {
  id: string;
  title: string;
  slug: string | null;
  summary: string | null;
  attributes: unknown;
  status: string;
  updatedAt?: Date;
}

export interface CustomerKnowledgeContextValue {
  customerSlug: string;
  customerId: string;
  customerTitle: string;
  skills: Skill[];
  totalSkills: number;
  sourcesByType: {
    url?: StagedSourceItem[];
    document?: StagedSourceItem[];
    slack?: StagedSourceItem[];
    gong?: StagedSourceItem[];
  };
}

const CustomerKnowledgeContext = createContext<CustomerKnowledgeContextValue | null>(null);

export function CustomerKnowledgeProvider({
  value,
  children,
}: {
  value: CustomerKnowledgeContextValue;
  children: ReactNode;
}) {
  return (
    <CustomerKnowledgeContext.Provider value={value}>
      {children}
    </CustomerKnowledgeContext.Provider>
  );
}

export function useCustomerKnowledge(): CustomerKnowledgeContextValue {
  const context = useContext(CustomerKnowledgeContext);
  if (!context) {
    throw new Error('useCustomerKnowledge must be used within a CustomerKnowledgeProvider');
  }
  return context;
}
