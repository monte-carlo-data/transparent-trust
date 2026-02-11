/**
 * Talent Library Layout
 *
 * Shared layout for all Talent library tabs.
 * Fetches data once and provides it to child routes via context.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { canAccessLibrary, isLibraryAdmin } from '@/lib/v2/teams';
import { redirect } from 'next/navigation';
import { LibraryProvider, fetchLibraryData } from '@/lib/v2/library-routes';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
}

export default async function TalentLibraryLayout({ children }: LayoutProps) {
  const session = await getServerSession(authOptions);

  // Check library access
  if (!session?.user?.id || !(await canAccessLibrary(session.user.id, 'talent'))) {
    redirect('/v2');
  }

  // Check if user is admin for this library
  const userIsAdmin = await isLibraryAdmin(session.user.id, 'talent');

  // Fetch all library data with error handling
  const contextValue = await fetchLibraryData({
    libraryId: 'talent',
    userId: session.user.id,
    userName: session.user.name || undefined,
    userEmail: session.user.email || undefined,
    userImage: session.user.image || undefined,
    isAdmin: userIsAdmin,
  });

  return <LibraryProvider value={contextValue}>{children}</LibraryProvider>;
}
