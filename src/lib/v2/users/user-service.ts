/**
 * UserService - Query users and their team memberships
 */

import { prisma } from '@/lib/prisma';

export interface UserWithMemberships {
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

export interface UserQueryOptions {
  search?: string;
  teamId?: string;
  excludeTeamId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all users with their team memberships.
 */
export async function getUsers(options: UserQueryOptions = {}): Promise<{
  users: UserWithMemberships[];
  total: number;
}> {
  const { search, teamId, excludeTeamId, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = {};

  // Search by name or email
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Filter by team membership
  if (teamId) {
    where.teamMemberships = {
      some: { teamId },
    };
  }

  // Exclude users already in a team (for adding new members)
  if (excludeTeamId) {
    where.teamMemberships = {
      none: { teamId: excludeTeamId },
    };
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        teamMemberships: {
          select: {
            teamId: true,
            role: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      teamMemberships: user.teamMemberships.map((m) => ({
        teamId: m.teamId,
        teamName: m.team.name,
        role: m.role,
      })),
    })),
    total,
  };
}

/**
 * Get a user by ID with team memberships.
 */
export async function getUserById(id: string): Promise<UserWithMemberships | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      teamMemberships: {
        select: {
          teamId: true,
          role: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    createdAt: user.createdAt,
    teamMemberships: user.teamMemberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      role: m.role,
    })),
  };
}

/**
 * Get total user count.
 */
export async function getUserCount(): Promise<number> {
  return prisma.user.count();
}
