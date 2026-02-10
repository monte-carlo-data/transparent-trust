/**
 * Unified Metadata Bar
 *
 * Config-driven metadata field rendering for all libraries.
 * Replaces: ITMetadataBar, CustomersMetadataBar, KnowledgeMetadataBar
 *
 * Also displays categories as badges.
 */

import type { LibraryId } from '@/types/v2';
import type { BlockLike } from '@/lib/v2/library-ui';
import { getMetadataConfig } from '@/lib/v2/library-ui';

interface UnifiedMetadataBarProps {
  block: BlockLike;
  libraryId: LibraryId;
}

/**
 * UnifiedMetadataBar - Config-driven metadata field rendering
 */
export function UnifiedMetadataBar({ block, libraryId }: UnifiedMetadataBarProps) {
  const config = getMetadataConfig(libraryId);

  // Filter fields by visibility and sort by order
  const visibleFields = config.fields
    .filter((field) => !field.visible || field.visible(block))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3); // Max 3 fields for layout

  const categories = block.categories || [];

  return (
    <>
      {visibleFields.map((field) => {
        const value = field.getValue(block);
        return (
          <div key={field.key}>
            {field.renderer({ value, field, block })}
          </div>
        );
      })}

      {/* Categories Display */}
      {categories.length > 0 && (
        <div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat: string) => (
              <span
                key={cat}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
