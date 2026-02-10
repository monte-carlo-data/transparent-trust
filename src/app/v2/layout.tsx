/**
 * V2 Layout
 *
 * Root layout for Platform V2 with navigation sidebar.
 */

import { ReactNode } from 'react';

interface V2LayoutProps {
  children: ReactNode;
}

// Force dynamic rendering across the V2 app so builds/tests don't try to
// statically prerender pages that hit Prisma (and a local DB).
export const dynamic = 'force-dynamic';

export default function V2Layout({ children }: V2LayoutProps) {
  // Auth is handled by the root layout middleware
  // This layout just passes through children
  return <>{children}</>;
}
