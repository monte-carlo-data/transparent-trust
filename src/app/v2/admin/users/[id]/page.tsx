/**
 * User Detail Page
 *
 * View user details and manage their team memberships.
 */

import { getUserById } from '@/lib/v2/users/user-service';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Users, Mail, Calendar, Shield, Eye } from 'lucide-react';
import { UserTeamManager } from './user-team-manager';

interface UserDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const { id } = await params;

  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  // Get all teams for adding user to teams
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: 'asc' },
  });

  // Filter out teams user is already in
  const availableTeams = allTeams.filter(
    (team) => !user.teamMemberships.some((m) => m.teamId === team.id)
  );

  const roleIcons: Record<string, typeof Shield> = {
    admin: Shield,
    member: Users,
    viewer: Eye,
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 border-purple-200',
    member: 'bg-blue-100 text-blue-700 border-blue-200',
    viewer: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        href="/v2/admin?tab=users"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </Link>

      {/* User Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || 'User'}
              width={80}
              height={80}
              className="rounded-full"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
              <Users className="w-10 h-10 text-gray-500" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {user.name || 'Unknown User'}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                {user.email || 'No email'}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team Memberships */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Team Memberships</h2>
            <p className="text-sm text-gray-500 mt-1">
              {user.teamMemberships.length === 0
                ? 'This user is not a member of any teams.'
                : `Member of ${user.teamMemberships.length} team${user.teamMemberships.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        {/* Current Teams */}
        {user.teamMemberships.length > 0 && (
          <div className="space-y-3 mb-6">
            {user.teamMemberships.map((membership) => {
              const RoleIcon = roleIcons[membership.role] || Users;
              return (
                <div
                  key={membership.teamId}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <Link
                        href={`/v2/teams/${membership.teamId}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {membership.teamName}
                      </Link>
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${
                      roleColors[membership.role] || roleColors.viewer
                    }`}
                  >
                    <RoleIcon className="w-3.5 h-3.5" />
                    {membership.role.charAt(0).toUpperCase() + membership.role.slice(1)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add to Team */}
        <UserTeamManager
          userId={user.id}
          availableTeams={availableTeams}
        />
      </div>
    </div>
  );
}
