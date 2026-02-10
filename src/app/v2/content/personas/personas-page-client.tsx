'use client';

/**
 * Personas Library Page with Create Modal
 *
 * Client wrapper that adds create persona button and modal to the generic LibraryPage
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { LibraryPage } from '@/app/v2/admin/library-page';
import { CreatePersonaModal } from '@/components/v2/CreatePersonaModal';
import type { LibraryId } from '@/types/v2';

interface LibraryPageWithPersonaModalProps {
  title: string;
  description: string;
  libraryId: LibraryId;
  basePath: string;
  backLink?: { href: string; label: string };
  items: Array<{
    id: string;
    title: string;
    slug: string | null;
    summary: string | null;
    status: string;
    updatedAt: string;
    attributes: unknown;
  }>;
  total: number;
  searchTerm?: string;
  statusFilter?: string;
  icon: 'Users' | 'FileText';
  accentColor: string;
}

export function LibraryPageWithPersonaModal({
  title,
  description,
  libraryId,
  basePath,
  backLink,
  items,
  total,
  searchTerm,
  statusFilter,
  icon,
  accentColor,
}: LibraryPageWithPersonaModalProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <>
      <div className="relative">
        {/* Create button - injected into the header */}
        <div className="absolute top-8 right-8 z-10">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Persona
          </button>
        </div>

        <LibraryPage
          title={title}
          description={description}
          libraryId={libraryId}
          basePath={basePath}
          backLink={backLink}
          items={items}
          total={total}
          searchTerm={searchTerm}
          statusFilter={statusFilter}
          icon={icon}
          accentColor={accentColor}
        />
      </div>

      {/* Create Persona Modal */}
      <CreatePersonaModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          window.location.reload();
        }}
      />
    </>
  );
}
