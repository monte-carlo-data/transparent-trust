/**
 * Unified Sidebar
 *
 * Config-driven sidebar section rendering for all libraries.
 * Replaces: ITSidebar, KnowledgeSidebar
 */

import type { LibraryId } from '@/types/v2';
import type { SidebarContext, BlockLike } from '@/lib/v2/library-ui/types';
import { getSidebarConfig } from '@/lib/v2/library-ui';

interface UnifiedSidebarProps extends Omit<SidebarContext, 'libraryId'> {
  block: BlockLike;
  libraryId: LibraryId;
}

/**
 * UnifiedSidebar - Config-driven sidebar section rendering
 */
export function UnifiedSidebar(props: UnifiedSidebarProps) {
  const { block, libraryId, ...contextData } = props;
  const config = getSidebarConfig(libraryId);

  const context: SidebarContext = {
    ...contextData,
    block,
    libraryId,
  };

  // Filter sections by visibility and sort by order
  const visibleSections = config.sections
    .filter((section) => !section.visible || section.visible(context))
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {visibleSections.map((section) => (
        <div key={section.key}>
          {section.component(context)}
        </div>
      ))}
    </>
  );
}
