/**
 * RFP Tabs Layout
 *
 * Server component that fetches shared data and provides it via RFPProvider.
 * Wraps all tab routes (ask, projects, history, dashboard).
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { notFound } from 'next/navigation';
import { RFPProvider } from './context';

interface RFPTabsLayoutProps {
  children: React.ReactNode;
}

export default async function RFPTabsLayout({ children }: RFPTabsLayoutProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    notFound();
  }

  const contextValue = {
    userId: session.user.id,
    userEmail: session.user.email || null,
  };

  return <RFPProvider value={contextValue}>{children}</RFPProvider>;
}
