import type { LibraryId } from '@/types/v2/building-block';

/** Generic block item used in the knowledge bar UI */
export interface KnowledgeBarItem {
  id: string;
  title: string;
  slug?: string;
  categories?: string[];
  entryType?: string | null;
  customerId?: string | null;
}

export interface LibraryContentData {
  libraryId: LibraryId;
  skills: KnowledgeBarItem[]; // BuildingBlock with blockType='knowledge', libraryId set
  documents: KnowledgeBarItem[]; // BuildingBlock with entryType='document'
}

export interface LibraryBarSettings {
  autoEnableKnowledge: boolean; // Default true
  autoEnableCustomerLibrary: boolean; // Default true
  defaultExpandedLibraries: LibraryId[]; // Default ['knowledge']
}

export interface Persona {
  id: string;
  name?: string;
  title?: string;
  slug?: string;
}

export interface LibrarySectionProps {
  libraryId: LibraryId;
  config: {
    id: LibraryId;
    name: string;
    accentColor: 'blue' | 'purple' | 'green' | 'amber';
    pluralName: string;
  };
  isEnabled: boolean;
  isExpanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
  skills: KnowledgeBarItem[];
  documents: KnowledgeBarItem[];
  selectedPersona?: Persona | null;
}

export interface CategoryGroupProps {
  category: string;
  skills: KnowledgeBarItem[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedCount: number;
  totalCount: number;
  onCategoryToggle: (selectAll: boolean) => void;
}

export interface SkillItemProps {
  skill: KnowledgeBarItem;
  isSelected: boolean;
  onToggle: () => void;
}
