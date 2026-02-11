'use client';

/**
 * Admin Dashboard Tabs
 *
 * Client component for tabbed interface: Users, Teams, Library Access.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import {
  Users,
  Shield,
  Library,
  Search,
  ChevronRight,
  Plus,
  Settings,
  Check,
  X,
  Loader2,
} from 'lucide-react';

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  createdAt: Date;
  teamMemberships: Array<{
    teamId: string;
    teamName: string;
    role: string;
  }>;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  libraries: string[];
}

interface LibraryInfo {
  id: string;
  name: string;
  description: string;
}

interface AdminTabsProps {
  activeTab: string;
  search?: string;
  users: User[];
  totalUsers: number;
  teams: Team[];
  libraries: LibraryInfo[];
}

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'teams', label: 'Teams', icon: Shield },
  { id: 'libraries', label: 'Library Access', icon: Library },
] as const;

export function AdminTabs({
  activeTab: initialTab,
  search: initialSearch,
  users,
  totalUsers,
  teams: initialTeams,
  libraries,
}: AdminTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [search, setSearch] = useState(initialSearch || '');
  const [localTeams, setLocalTeams] = useState(initialTeams);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    if (tabId !== 'users') {
      url.searchParams.delete('search');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'users');
    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }
    router.push(url.pathname + url.search);
  };

  const toggleAccess = async (teamId: string, libraryId: string) => {
    const key = `${teamId}-${libraryId}`;
    setUpdating(key);

    const team = localTeams.find((t) => t.id === teamId);
    if (!team) return;

    const hasAccess = team.libraries.includes(libraryId);
    const newLibraries = hasAccess
      ? team.libraries.filter((l) => l !== libraryId)
      : [...team.libraries, libraryId];

    // Optimistic update
    setLocalTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, libraries: newLibraries } : t))
    );

    try {
      const response = await fetch(`/api/v2/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraries: newLibraries }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update access');
      }

      toast.success(
        hasAccess
          ? `Removed ${libraryId} access from ${team.name}`
          : `Granted ${libraryId} access to ${team.name}`
      );
    } catch (error) {
      // Revert on error
      setLocalTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, libraries: team.libraries } : t))
      );
      const message = error instanceof Error ? error.message : 'Failed to update';
      toast.error(message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === 'users' ? totalUsers : tab.id === 'teams' ? localTeams.length : libraries.length;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            {/* Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </form>

            {/* Users Table */}
            {users.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                <p className="text-gray-500">
                  {initialSearch
                    ? 'No users match your search criteria.'
                    : 'Users will appear here when they sign in.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Teams
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {user.image ? (
                              <Image
                                src={user.image}
                                alt={user.name || 'User'}
                                width={40}
                                height={40}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.name || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.teamMemberships.length === 0 ? (
                            <span className="text-sm text-gray-400">No teams</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {user.teamMemberships.slice(0, 3).map((membership) => (
                                <span
                                  key={membership.teamId}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    membership.role === 'admin'
                                      ? 'bg-purple-100 text-purple-700'
                                      : membership.role === 'member'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {membership.teamName}
                                </span>
                              ))}
                              {user.teamMemberships.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{user.teamMemberships.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/v2/admin/users/${user.id}`}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                          >
                            View
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex justify-end mb-6">
              <Link
                href="/v2/teams/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New Team
              </Link>
            </div>

            {localTeams.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
                <p className="text-gray-500 mb-4">
                  Create a team to organize access to libraries.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {localTeams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/v2/teams/${team.id}`}
                    className="block p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <Settings className="w-5 h-5 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {team.name}
                    </h3>
                    {team.description && (
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                        {team.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                      </span>
                      <span className="text-gray-400">
                        {team.libraries.length} {team.libraries.length === 1 ? 'library' : 'libraries'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Library Access Tab */}
        {activeTab === 'libraries' && (
          <div>
            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> Users inherit library access from their teams. A user can access a library if any of their teams has access to it. Click cells to toggle access.
              </p>
            </div>

            {localTeams.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No teams exist yet. Create a team first.</p>
                <Link
                  href="/v2/teams/new"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Team
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                        Team
                      </th>
                      {libraries.map((lib) => (
                        <th
                          key={lib.id}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]"
                          title={lib.description}
                        >
                          {lib.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {localTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {team.name}
                        </td>
                        {libraries.map((lib) => {
                          const hasAccess = team.libraries.includes(lib.id);
                          const isUpdating = updating === `${team.id}-${lib.id}`;

                          return (
                            <td key={lib.id} className="px-4 py-4 text-center">
                              <button
                                onClick={() => toggleAccess(team.id, lib.id)}
                                disabled={isUpdating}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                  hasAccess
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                } ${isUpdating ? 'opacity-50' : ''}`}
                                title={hasAccess ? 'Click to revoke' : 'Click to grant'}
                              >
                                {isUpdating ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : hasAccess ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-600" />
                  </div>
                  <span>Has access</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                    <X className="w-3 h-3 text-gray-400" />
                  </div>
                  <span>No access</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
