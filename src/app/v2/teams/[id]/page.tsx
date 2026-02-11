/**
 * Team Detail Page
 *
 * View and manage a team, including member management.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Trash2, Users, Settings, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { LIBRARY_UI_CONFIG } from '@/lib/v2/library-constants';
import { UserPicker } from '@/components/v2/admin/UserPicker';
import { MemberCard } from '@/components/v2/admin/MemberCard';

interface TeamMember {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
}

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  libraries: string[];
  members: Array<{
    userId: string;
    role: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>;
}

// Use centralized library configuration for consistency
const libraries = LIBRARY_UI_CONFIG.map(lib => ({ id: lib.id, label: lib.label }));

type TabId = 'settings' | 'members';

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<TabId>('settings');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Fetch team data
  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/v2/teams/${teamId}`);
        if (!response.ok) throw new Error('Failed to fetch team');
        const data = await response.json();
        setTeam(data);
        setName(data.name);
        setDescription(data.description || '');
        setSelectedLibraries(data.libraries || []);
      } catch {
        toast.error('Failed to load team');
        router.push('/v2/admin?tab=teams');
      } finally {
        setIsLoading(false);
      }
    };

    if (teamId) fetchTeam();
  }, [teamId, router]);

  // Fetch members
  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`/api/v2/teams/${teamId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId) fetchMembers();
  }, [teamId, fetchMembers]);

  // Get current user from session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          const session = await response.json();
          setCurrentUserId(session?.user?.id || null);
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };
    fetchSession();
  }, []);

  // Check if current user is admin
  useEffect(() => {
    if (currentUserId && members.length > 0) {
      const currentMember = members.find((m) => m.userId === currentUserId);
      setIsAdmin(currentMember?.role === 'admin');
    }
  }, [currentUserId, members]);

  const handleToggleLibrary = (libraryId: string) => {
    setSelectedLibraries((prev) => {
      const updated = prev.includes(libraryId)
        ? prev.filter((id) => id !== libraryId)
        : [...prev, libraryId];
      setIsDirty(true);
      return updated;
    });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setIsDirty(true);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Team name is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v2/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          libraries: selectedLibraries,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }

      const updated = await response.json();
      setTeam({ ...team, ...updated });
      setIsDirty(false);
      toast.success('Team updated successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update team';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this team? This cannot be undone.')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/v2/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete team');
      }

      toast.success('Team deleted successfully');
      router.push('/v2/teams');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete team';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (user: { id: string; name: string | null; email: string | null }) => {
    try {
      const response = await fetch(`/api/v2/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: 'member',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add member');
      }

      toast.success(`Added ${user.name || user.email} to team`);
      setShowAddMember(false);
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add member';
      toast.error(message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      const response = await fetch(`/api/v2/teams/${teamId}/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      toast.success('Role updated');
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role';
      toast.error(message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const response = await fetch(`/api/v2/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      toast.success('Member removed');
      fetchMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const tabs = [
    { id: 'settings' as TabId, label: 'Settings', icon: Settings },
    { id: 'members' as TabId, label: `Members (${members.length})`, icon: Users },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <Link
        href="/v2/admin?tab=teams"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Teams
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage team settings, library access, and members
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Team Name */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Team Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={handleNameChange}
                disabled={isSaving || !isAdmin}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={handleDescriptionChange}
                disabled={isSaving || !isAdmin}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            </div>

            {/* Library Access */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Library Access</h3>
              <p className="text-xs text-gray-500 mb-4">
                Select which content libraries this team can access and manage.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {libraries.map((lib) => (
                  <label key={lib.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLibraries.includes(lib.id)}
                      onChange={() => handleToggleLibrary(lib.id)}
                      disabled={isSaving || !isAdmin}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{lib.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            {isAdmin && (
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
                {isDirty && (
                  <button
                    onClick={() => {
                      setName(team.name);
                      setDescription(team.description || '');
                      setSelectedLibraries(team.libraries || []);
                      setIsDirty(false);
                    }}
                    disabled={isSaving}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Team Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Members</span>
                  <span className="font-medium text-gray-900">{members.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Libraries</span>
                  <span className="font-medium text-gray-900">{selectedLibraries.length}</span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {isAdmin && (
              <div className="bg-red-50 rounded-lg border border-red-200 p-6">
                <h3 className="text-sm font-semibold text-red-900 mb-4">Danger Zone</h3>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Team
                </button>
                <p className="mt-2 text-xs text-red-700">
                  This action cannot be undone.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Add Member Button */}
          {isAdmin && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Manage who has access to this team and their roles.
              </p>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            </div>
          )}

          {/* Add Member Picker */}
          {showAddMember && (
            <div className="max-w-md">
              <UserPicker
                excludeTeamId={teamId}
                onSelect={handleAddMember}
                onCancel={() => setShowAddMember(false)}
              />
            </div>
          )}

          {/* Members List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member) => (
              <MemberCard
                key={member.userId}
                userId={member.userId}
                name={member.user.name}
                email={member.user.email}
                image={member.user.image}
                role={member.role}
                isCurrentUser={member.userId === currentUserId}
                canEdit={isAdmin}
                onRoleChange={handleRoleChange}
                onRemove={handleRemoveMember}
              />
            ))}
          </div>

          {members.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No members yet</p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(true)}
                  className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Add the first member
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
