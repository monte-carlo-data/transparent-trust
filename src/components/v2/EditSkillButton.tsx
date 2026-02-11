'use client';

/**
 * EditSkillButton - Navigate to full-page skill editor
 *
 * Opens the comprehensive skill editor at /edit page for all skill properties.
 */

import { useRouter } from 'next/navigation';
import { Edit } from 'lucide-react';
import type { LibraryId, TypedBuildingBlock } from '@/types/v2/building-block';

export interface EditSkillButtonProps {
  skill: TypedBuildingBlock;
  libraryId: LibraryId;
  customerSlug?: string; // For customer-scoped skills
}

export function EditSkillButton({ skill, libraryId, customerSlug }: EditSkillButtonProps) {
  const router = useRouter();

  const getEditPath = () => {
    switch (libraryId) {
      case 'knowledge':
        return `/v2/knowledge/${skill.slug}/edit`;
      case 'it':
        return `/v2/it/${skill.slug}/edit`;
      case 'gtm':
        return `/v2/gtm/${skill.slug}/edit`;
      case 'talent':
        return `/v2/talent/${skill.slug}/edit`;
      case 'customers':
        if (!customerSlug) {
          console.error('customerSlug is required for customer skills');
          return '#';
        }
        return `/v2/customers/${customerSlug}/skills/${skill.slug}/edit`;
      default:
        return '#';
    }
  };

  return (
    <button
      onClick={() => router.push(getEditPath())}
      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
    >
      <Edit className="w-4 h-4" />
      Edit
    </button>
  );
}
