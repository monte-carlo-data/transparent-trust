/**
 * Library UI Type Definitions
 *
 * Core types for metadata fields and sidebar sections.
 */

import type { LucideIcon } from 'lucide-react';
import type { TypedBuildingBlock, LibraryId } from '@/types/v2';
import type { BuildingBlock as PrismaBuildingBlock } from '@prisma/client';
import type { ReactNode } from 'react';

/**
 * Permissive block type that accepts both Prisma results and typed blocks.
 * Used in components that work with raw Prisma query results where the
 * discriminated union types (literal strings) aren't available.
 */
export type BlockLike = PrismaBuildingBlock | TypedBuildingBlock;

// =============================================================================
// METADATA FIELD CONFIGURATION
// =============================================================================

/**
 * Defines how to extract, render, and display a metadata field
 */
export interface MetadataFieldConfig {
  /** Unique identifier for this field */
  key: string;

  /** Display label */
  label: string;

  /** Help text shown below value */
  description: string;

  /** Icon component from Lucide */
  icon?: LucideIcon;

  /** Which renderer to use */
  renderer: (props: MetadataFieldRenderProps) => ReactNode;

  /** Extract value from block attributes - accepts BlockLike for Prisma compat */
  getValue: (block: BlockLike) => unknown;

  /** Conditional visibility (optional) - accepts BlockLike for Prisma compat */
  visible?: (block: BlockLike) => boolean;

  /** Sort order in metadata bar (lower = left) */
  order: number;
}

export interface MetadataFieldRenderProps {
  value: unknown;
  field: MetadataFieldConfig;
  block: BlockLike;
}

/**
 * Library-specific metadata bar configuration
 */
export interface LibraryMetadataConfig {
  libraryId: LibraryId;
  /** Fields to display in metadata bar (max 3 for layout) */
  fields: MetadataFieldConfig[];
}

// =============================================================================
// SIDEBAR SECTION CONFIGURATION
// =============================================================================

/**
 * Defines a sidebar section to render
 */
export interface SidebarSectionConfig {
  /** Unique identifier */
  key: string;

  /** Section component or composer function */
  component: SidebarSectionComponent;

  /** Conditional visibility */
  visible?: (context: SidebarContext) => boolean;

  /** Sort order (lower = top) */
  order: number;
}

/**
 * Context passed to sidebar section components
 */
export interface SidebarContext {
  block: BlockLike;
  skillId: string;
  skillTitle: string;
  libraryId: LibraryId;

  // Fetched data
  incorporatedSources: Array<{
    id: string;
    incorporatedAt: Date | null;
    stagedSource: {
      id: string;
      title: string | null;
      sourceType?: string;
    };
  }>;
  pendingSources: Array<{
    id: string;
    title: string | null;
    sourceType: string;
    stagedAt?: Date;
  }>;
  relatedSkills: Array<{
    id: string;
    title: string;
    slug: string | null;
  }>;
}

/**
 * Sidebar section component signature
 */
export type SidebarSectionComponent = (context: SidebarContext) => ReactNode;

/**
 * Library-specific sidebar configuration
 */
export interface LibrarySidebarConfig {
  libraryId: LibraryId;
  sections: SidebarSectionConfig[];
}
