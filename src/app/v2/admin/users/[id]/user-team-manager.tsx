/**
 * User Team Manager
 *
 * Client component for adding a user to teams.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

interface UserTeamManagerProps {
  userId: string;
  availableTeams: Array<{
    id: string;
    name: string;
  }>;
}

export function UserTeamManager({ userId, availableTeams }: UserTeamManagerProps) {
  const router = useRouter();
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToTeam = async () => {
    if (!selectedTeamId) {
      toast.error('Please select a team');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`/api/v2/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add user to team');
      }

      toast.success('User added to team');
      setSelectedTeamId('');
      setSelectedRole('member');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add to team';
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  if (availableTeams.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        This user is already a member of all teams.
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 pt-6">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Add to Team</h3>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm text-gray-600 mb-1">Team</label>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            disabled={isAdding}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select a team...</option>
            {availableTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-sm text-gray-600 mb-1">Role</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={isAdding}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="viewer">Viewer</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          onClick={handleAddToTeam}
          disabled={isAdding || !selectedTeamId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isAdding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          Add
        </button>
      </div>
    </div>
  );
}
