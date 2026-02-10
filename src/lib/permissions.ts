/**
 * Permissions Library (v2)
 *
 * Team-based permission checks for the unified BuildingBlock architecture.
 */

export type UserSession = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export type TeamMembership = {
  teamId: string;
  role: string; // 'admin', 'member', 'viewer'
};

export type OwnedResource = {
  ownerId?: string | null;
  teamId?: string | null;
};

/**
 * Check if user is a team admin
 */
export function isTeamAdmin(
  membership: TeamMembership | null | undefined
): boolean {
  return membership?.role === "admin" || membership?.role === "ADMIN";
}

/**
 * Check if user is at least a member (not viewer)
 */
export function isTeamMember(
  membership: TeamMembership | null | undefined
): boolean {
  return membership?.role === "admin" || membership?.role === "member" ||
         membership?.role === "ADMIN" || membership?.role === "MEMBER";
}

/**
 * Check if user can view a resource
 * Requires any team membership (viewer or above)
 */
export function canViewResource(
  user: UserSession | null | undefined,
  membership: TeamMembership | null | undefined
): boolean {
  if (!user) return false;
  return membership !== null && membership !== undefined;
}

/**
 * Check if user can edit a resource
 * Requires member role or above, or ownership
 */
export function canEditResource(
  user: UserSession | null | undefined,
  resource: OwnedResource,
  membership: TeamMembership | null | undefined
): boolean {
  if (!user) return false;
  if (resource.ownerId === user.id) return true;
  return isTeamMember(membership);
}

/**
 * Check if user can delete a resource
 * Requires admin role or ownership
 */
export function canDeleteResource(
  user: UserSession | null | undefined,
  resource: OwnedResource,
  membership: TeamMembership | null | undefined
): boolean {
  if (!user) return false;
  if (resource.ownerId === user.id) return true;
  return isTeamAdmin(membership);
}

/**
 * Check if user can manage team settings
 */
export function canManageTeam(
  membership: TeamMembership | null | undefined
): boolean {
  return isTeamAdmin(membership);
}

/**
 * Check if user can invite members to team
 */
export function canInviteMembers(
  membership: TeamMembership | null | undefined
): boolean {
  return isTeamAdmin(membership);
}

/**
 * Check if user can create new blocks
 */
export function canCreateBlocks(
  membership: TeamMembership | null | undefined
): boolean {
  return isTeamMember(membership);
}

/**
 * Check if user can manage sources (staged content)
 */
export function canManageSources(
  membership: TeamMembership | null | undefined
): boolean {
  return isTeamMember(membership);
}

/**
 * Check if user can manage knowledge (blocks)
 * Any authenticated user can manage knowledge.
 * Team-specific access is enforced at the block/API level.
 */
export function canManageKnowledge(
  user: UserSession | null | undefined
): boolean {
  return user !== null && user !== undefined;
}
