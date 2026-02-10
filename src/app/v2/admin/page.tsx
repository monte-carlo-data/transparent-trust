/**
 * V2 Admin Dashboard
 *
 * Central hub for access management with tabs for Users, Teams, and Library Access.
 * Settings and Prompt Registry are separate pages.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { Settings, FileCode, ChevronRight, Loader2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getUsers, getUserCount } from '@/lib/v2/users/user-service';
import { allCompositions } from '@/lib/v2/prompts/compositions';
import { coreBlocks } from '@/lib/v2/prompts/blocks/core-blocks';
import { AdminTabs } from './admin-tabs';

// Force dynamic rendering so builds don't try to hit the database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIBRARIES = [
  { id: 'knowledge', name: 'Knowledge', description: 'Internal knowledge base and documentation' },
  { id: 'it', name: 'IT', description: 'IT support and technical procedures' },
  { id: 'gtm', name: 'GTM', description: 'Go-to-market and customer profiles' },
  { id: 'talent', name: 'Talent', description: 'Recruiting, hiring, and talent management' },
  { id: 'prompts', name: 'Prompts', description: 'System prompts and instructions' },
  { id: 'personas', name: 'Personas', description: 'Communication personas and styles' },
  { id: 'templates', name: 'Templates', description: 'Output templates and formats' },
];

interface AdminPageProps {
  searchParams: Promise<{
    tab?: string;
    search?: string;
  }>;
}

async function getAdminData(search?: string) {
  const [{ users }, totalUsers, teams] = await Promise.all([
    getUsers({ search, limit: 100 }),
    getUserCount(),
    prisma.team.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Transform teams for the matrix
  const teamsWithAccess = teams.map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    memberCount: team._count.members,
    libraries: (team.libraries as string[]) || [],
  }));

  return { users, totalUsers, teams: teamsWithAccess };
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  noStore();

  const params = await searchParams;
  const activeTab = params.tab || 'users';
  const search = params.search;

  const { users, totalUsers, teams } = await getAdminData(search);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-500 mt-1">
          Manage users, teams, and system configuration
        </p>
      </div>

      {/* Quick Links to Settings & Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link
          href="/v2/prompt-registry"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <FileCode className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Prompt Registry</h3>
            <p className="text-sm text-gray-500">{allCompositions.length} compositions • {coreBlocks.length} blocks</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>
        <Link
          href="/v2/admin/settings"
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="p-2 rounded-lg bg-gray-100 text-gray-700">
            <Settings className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Settings</h3>
            <p className="text-sm text-gray-500">Branding, integrations, usage</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>
      </div>

      {/* Tabbed Content */}
      <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}>
        <AdminTabs
          activeTab={activeTab}
          search={search}
          users={users}
          totalUsers={totalUsers}
          teams={teams}
          libraries={LIBRARIES}
        />
      </Suspense>
    </div>
  );
}
