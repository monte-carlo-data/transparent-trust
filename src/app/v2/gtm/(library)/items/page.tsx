/**
 * GTM Library - Skills List Tab
 */

import { LibraryContent } from '@/lib/v2/library-routes';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    review?: string;
  }>;
}

export default async function GTMItemsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <LibraryContent
      activeTab="items"
      searchParams={{
        search: params.search,
        review: params.review,
      }}
    />
  );
}
