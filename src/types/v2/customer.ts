/**
 * Customer TypeScript Types
 *
 * Customers are first-class entities that own skill libraries.
 * Each customer has their own collection of skills organized by libraryId.
 */

import type { Customer as PrismaCustomer } from '@prisma/client';

export type Customer = PrismaCustomer;

export interface CustomerContact {
  name: string;
  role: string;
  email?: string;
}

export interface CreateCustomerInput {
  slug?: string;
  company: string;
  industry?: string;
  tier?: 'enterprise' | 'mid-market' | 'smb';
  healthScore?: number;
  crmId?: string;
  contacts?: CustomerContact[];
  products?: string[];
  summary?: string;
  notes?: string;
  teamId?: string;
  ownerId?: string;
  status?: 'ACTIVE' | 'CHURNED' | 'PROSPECT';
}

export interface UpdateCustomerInput {
  slug?: string;
  company?: string;
  industry?: string;
  tier?: 'enterprise' | 'mid-market' | 'smb';
  healthScore?: number;
  crmId?: string;
  contacts?: CustomerContact[];
  products?: string[];
  summary?: string;
  notes?: string;
  status?: 'ACTIVE' | 'CHURNED' | 'PROSPECT';
}

export interface CustomerQueryOptions {
  teamId?: string;
  status?: string;
  tier?: string;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'company' | 'createdAt' | 'updatedAt' | 'healthScore';
  orderDir?: 'asc' | 'desc';
}
