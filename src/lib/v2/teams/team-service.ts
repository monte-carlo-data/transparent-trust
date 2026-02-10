/**
 * TeamService - Manage teams and memberships
 *
 * This service handles team structure for multi-tenant ownership:
 * - Create/update/delete teams
 * - Manage team memberships
 * - Control which libraries a team owns
 * - Track team token usage
 */

import { prisma } from '@/lib/prisma';
import type { Team, TeamMembership, Prisma } from '@prisma/client';
import type { LibraryId } from '@/types/v2';
import { createSlug } from '@/lib/frontmatterStore';

// =============================================================================
// TYPES
// =============================================================================

export type TeamRole = 'admin' | 'member' | 'viewer';

export interface TeamWithMembers extends Team {
  members: (TeamMembership & { user: { id: string; name: string | null; email: string | null } })[];
}

export interface CreateTeamInput {
  name: string;
  slug?: string;
  description?: string;
  libraries?: LibraryId[];
  monthlyTokenLimit?: number;
  settings?: Record<string, unknown>;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  libraries?: LibraryId[];
  monthlyTokenLimit?: number;
  settings?: Record<string, unknown>;
}

export interface AddMemberInput {
  teamId: string;
  userId: string;
  role?: TeamRole;
}

// =============================================================================
// CREATE
// =============================================================================

/**
 * Create a new team.
 */
export async function createTeam(input: CreateTeamInput): Promise<Team> {
  const slug = input.slug || createSlug(input.name);

  const team = await prisma.team.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      libraries: input.libraries || [],
      monthlyTokenLimit: input.monthlyTokenLimit,
      settings: (input.settings || {}) as Prisma.InputJsonValue,
    },
  });

  return team;
}

/**
 * Create a team with initial members.
 */
export async function createTeamWithMembers(
  input: CreateTeamInput,
  members: { userId: string; role?: TeamRole }[]
): Promise<TeamWithMembers> {
  const slug = input.slug || createSlug(input.name);

  const team = await prisma.team.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      libraries: input.libraries || [],
      monthlyTokenLimit: input.monthlyTokenLimit,
      settings: (input.settings || {}) as Prisma.InputJsonValue,
      members: {
        create: members.map((m) => ({
          userId: m.userId,
          role: m.role || 'member',
        })),
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  return team;
}

// =============================================================================
// READ
// =============================================================================

/**
 * Get a team by ID.
 */
export async function getTeamById(id: string): Promise<TeamWithMembers | null> {
  return prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });
}

/**
 * Get a team by slug.
 */
export async function getTeamBySlug(slug: string): Promise<TeamWithMembers | null> {
  return prisma.team.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });
}

/**
 * Get all teams.
 */
export async function getAllTeams(): Promise<Team[]> {
  return prisma.team.findMany({
    orderBy: { name: 'asc' },
  });
}

/**
 * Get teams for a user.
 */
export async function getTeamsForUser(userId: string): Promise<TeamWithMembers[]> {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => m.team);
}

/**
 * Get teams that own a specific library.
 */
export async function getTeamsForLibrary(libraryId: LibraryId): Promise<Team[]> {
  return prisma.team.findMany({
    where: {
      libraries: { has: libraryId },
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Check if a user is an admin for a specific library.
 * A user is a library admin if they are an admin in ANY team that manages that library.
 */
export async function isLibraryAdmin(userId: string, libraryId: LibraryId): Promise<boolean> {
  // Get all teams that manage this library
  const teamsForLibrary = await getTeamsForLibrary(libraryId);
  if (teamsForLibrary.length === 0) {
    return false;
  }

  // Check if user is admin in any of these teams
  for (const team of teamsForLibrary) {
    const adminStatus = await isAdmin(team.id, userId);
    if (adminStatus) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update a team.
 */
export async function updateTeam(id: string, input: UpdateTeamInput): Promise<Team> {
  return prisma.team.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.libraries !== undefined && { libraries: input.libraries }),
      ...(input.monthlyTokenLimit !== undefined && { monthlyTokenLimit: input.monthlyTokenLimit }),
      ...(input.settings !== undefined && { settings: input.settings as Prisma.InputJsonValue }),
    },
  });
}

/**
 * Add a library to a team's ownership.
 */
export async function addLibraryToTeam(teamId: string, libraryId: LibraryId): Promise<Team> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const libraries = team.libraries.includes(libraryId)
    ? team.libraries
    : [...team.libraries, libraryId];

  return prisma.team.update({
    where: { id: teamId },
    data: { libraries },
  });
}

/**
 * Remove a library from a team's ownership.
 */
export async function removeLibraryFromTeam(teamId: string, libraryId: LibraryId): Promise<Team> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const libraries = team.libraries.filter((l) => l !== libraryId);

  return prisma.team.update({
    where: { id: teamId },
    data: { libraries },
  });
}

// =============================================================================
// DELETE
// =============================================================================

/**
 * Delete a team and all its memberships.
 */
export async function deleteTeam(id: string): Promise<void> {
  await prisma.team.delete({
    where: { id },
  });
}

// =============================================================================
// MEMBERSHIP MANAGEMENT
// =============================================================================

/**
 * Add a member to a team.
 */
export async function addMember(input: AddMemberInput): Promise<TeamMembership> {
  return prisma.teamMembership.create({
    data: {
      teamId: input.teamId,
      userId: input.userId,
      role: input.role || 'member',
    },
  });
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: TeamRole
): Promise<TeamMembership> {
  return prisma.teamMembership.update({
    where: {
      userId_teamId: { userId, teamId },
    },
    data: { role },
  });
}

/**
 * Remove a member from a team.
 */
export async function removeMember(teamId: string, userId: string): Promise<void> {
  await prisma.teamMembership.delete({
    where: {
      userId_teamId: { userId, teamId },
    },
  });
}

/**
 * Check if a user is a member of a team.
 */
export async function isMember(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
  });

  return !!membership;
}

/**
 * Check if a user is an admin of a team.
 */
export async function isAdmin(teamId: string, userId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
  });

  return membership?.role === 'admin';
}

/**
 * Get a user's role in a team.
 */
export async function getMemberRole(
  teamId: string,
  userId: string
): Promise<TeamRole | null> {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: { userId, teamId },
    },
  });

  return membership?.role as TeamRole | null;
}

// =============================================================================
// TOKEN USAGE
// =============================================================================

/**
 * Add token usage to a team's monthly count.
 */
export async function addTokenUsage(teamId: string, tokens: number): Promise<Team> {
  return prisma.team.update({
    where: { id: teamId },
    data: {
      currentMonthTokens: { increment: tokens },
    },
  });
}

/**
 * Reset monthly token usage (call at start of month).
 */
export async function resetMonthlyTokenUsage(teamId?: string): Promise<{ reset: number }> {
  const result = await prisma.team.updateMany({
    where: teamId ? { id: teamId } : {},
    data: { currentMonthTokens: 0 },
  });

  return { reset: result.count };
}

/**
 * Check if a team has exceeded its token limit.
 */
export async function hasExceededTokenLimit(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { monthlyTokenLimit: true, currentMonthTokens: true },
  });

  if (!team || !team.monthlyTokenLimit) return false;

  return team.currentMonthTokens >= team.monthlyTokenLimit;
}

/**
 * Get token usage stats for a team.
 */
export async function getTokenUsageStats(teamId: string): Promise<{
  current: number;
  limit: number | null;
  percentUsed: number | null;
  remaining: number | null;
}> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { monthlyTokenLimit: true, currentMonthTokens: true },
  });

  if (!team) throw new Error(`Team not found: ${teamId}`);

  const limit = team.monthlyTokenLimit;
  const current = team.currentMonthTokens;

  return {
    current,
    limit,
    percentUsed: limit ? Math.round((current / limit) * 100) : null,
    remaining: limit ? Math.max(0, limit - current) : null,
  };
}

// =============================================================================
// AUTHORIZATION HELPERS
// =============================================================================

/**
 * Check if a user can access a library (via team membership).
 */
export async function canAccessLibrary(
  userId: string,
  libraryId: LibraryId
): Promise<boolean> {
  const teams = await getTeamsForUser(userId);

  return teams.some((team) => team.libraries.includes(libraryId));
}

/**
 * Get all libraries a user can access.
 */
export async function getAccessibleLibraries(userId: string): Promise<LibraryId[]> {
  const teams = await getTeamsForUser(userId);

  const librarySet = new Set<LibraryId>();
  for (const team of teams) {
    for (const lib of team.libraries) {
      librarySet.add(lib as LibraryId);
    }
  }

  return Array.from(librarySet);
}

/**
 * Check if a user can manage (edit/delete) a library.
 */
export async function canManageLibrary(
  userId: string,
  libraryId: LibraryId
): Promise<boolean> {
  const teams = await prisma.teamMembership.findMany({
    where: {
      userId,
      role: { in: ['admin', 'member'] }, // Viewers cannot manage
    },
    include: {
      team: true,
    },
  });

  return teams.some((m) => m.team.libraries.includes(libraryId));
}
