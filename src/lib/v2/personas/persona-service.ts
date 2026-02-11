import { prisma } from '@/lib/prisma';
import type { BuildingBlock as PrismaBuildingBlock, Prisma } from '@prisma/client';
import type { PersonaAttributes } from '@/types/v2/building-block';

export interface PersonaBlock extends Omit<PrismaBuildingBlock, 'attributes'> {
  blockType: 'persona';
  libraryId: 'personas';
  attributes: PersonaAttributes;
}

/**
 * Query personas with optional filters
 */
export async function queryPersonas(options: {
  search?: string;
  isDefault?: boolean;
  shareStatus?: 'PRIVATE' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'title';
  orderDir?: 'asc' | 'desc';
} = {}) {
  const {
    search,
    isDefault,
    shareStatus,
    limit = 50,
    offset = 0,
    orderBy = 'title',
    orderDir = 'asc',
  } = options;

  // If filtering by JSON attributes, we need to fetch all and filter in-memory
  // Prisma doesn't support JSON attribute filters well
  const needsAttributeFiltering = isDefault !== undefined || shareStatus !== undefined;

  if (needsAttributeFiltering) {
    // Fetch all matching records (without pagination) to filter by JSON attributes
    const allBlocks = await prisma.buildingBlock.findMany({
      where: {
        libraryId: 'personas',
        blockType: 'persona',
        status: 'ACTIVE',
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { [orderBy]: orderDir },
    });

    // Filter by JSON attributes in-memory
    const filtered = allBlocks.filter((b) => {
      const attrs = b.attributes as PersonaAttributes;
      if (isDefault !== undefined && attrs.isDefault !== isDefault) return false;
      if (shareStatus && attrs.shareStatus !== shareStatus) return false;
      return true;
    });

    // Apply pagination to filtered results
    const paginated = filtered.slice(offset, offset + limit);

    return { personas: paginated as PersonaBlock[], total: filtered.length };
  }

  // No JSON filtering needed - use efficient database pagination
  const [blocks, total] = await Promise.all([
    prisma.buildingBlock.findMany({
      where: {
        libraryId: 'personas',
        blockType: 'persona',
        status: 'ACTIVE',
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { [orderBy]: orderDir },
      skip: offset,
      take: limit,
    }),
    prisma.buildingBlock.count({
      where: {
        libraryId: 'personas',
        blockType: 'persona',
        status: 'ACTIVE',
        ...(search && { title: { contains: search, mode: 'insensitive' } }),
      },
    }),
  ]);

  return { personas: blocks as PersonaBlock[], total };
}

/**
 * Get a specific persona by ID
 */
export async function getPersona(id: string): Promise<PersonaBlock | null> {
  const block = await prisma.buildingBlock.findFirst({
    where: {
      id,
      libraryId: 'personas',
      blockType: 'persona',
      status: 'ACTIVE',
    },
  });

  return block as PersonaBlock | null;
}

/**
 * Create a new persona
 */
export async function createPersona(input: {
  title: string;
  content: string;
  summary?: string;
  attributes: PersonaAttributes;
  ownerId: string;
  teamId?: string;
  customerId?: string;
}) {
  const block = await prisma.buildingBlock.create({
    data: {
      id: crypto.randomUUID(),
      libraryId: 'personas',
      blockType: 'persona',
      title: input.title,
      slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      content: input.content,
      summary: input.summary,
      attributes: input.attributes as Prisma.InputJsonValue,
      status: 'ACTIVE',
      ownerId: input.ownerId,
      teamId: input.teamId,
      customerId: input.customerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return block as PersonaBlock;
}

/**
 * Update a persona
 */
export async function updatePersona(
  id: string,
  updates: {
    title?: string;
    content?: string;
    summary?: string;
    attributes?: PersonaAttributes;
    status?: 'ACTIVE' | 'ARCHIVED';
  }
) {
  const { attributes, ...restUpdates } = updates;
  const block = await prisma.buildingBlock.update({
    where: { id },
    data: {
      ...restUpdates,
      ...(attributes && { attributes: attributes as Prisma.InputJsonValue }),
      updatedAt: new Date(),
    },
  });

  return block as PersonaBlock;
}

/**
 * Delete a persona (archive it)
 */
export async function deletePersona(id: string) {
  return prisma.buildingBlock.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      updatedAt: new Date(),
    },
  });
}

/**
 * Get default persona(s) for a user
 */
export async function getDefaultPersonas() {
  const blocks = await prisma.buildingBlock.findMany({
    where: {
      libraryId: 'personas',
      blockType: 'persona',
      status: 'ACTIVE',
    },
  });

  // Filter for default personas by checking attributes
  const defaultPersonas = blocks.filter((b) => {
    const attrs = b.attributes as PersonaAttributes;
    return attrs.isDefault === true;
  });

  return defaultPersonas as PersonaBlock[];
}
