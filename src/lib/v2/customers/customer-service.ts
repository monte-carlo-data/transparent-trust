/**
 * Customer Service - CRUD operations for Customer model
 *
 * Customers are first-class entities that own skill libraries.
 * This service handles creation, retrieval, updating, and deletion of customers.
 */

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQueryOptions,
  CustomerContact,
} from '@/types/v2';
import { createSlug } from '@/lib/frontmatterStore';

const VALID_TIERS = ['enterprise', 'mid-market', 'smb'] as const;
const VALID_STATUSES = ['ACTIVE', 'CHURNED', 'PROSPECT'] as const;

export class CustomerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerValidationError';
  }
}

/**
 * Validate customer input for creation or update
 */
function validateCustomerInput(
  input: CreateCustomerInput | UpdateCustomerInput,
  isCreate: boolean
): void {
  // Company is required for creation
  if (isCreate && !('company' in input && input.company?.trim())) {
    throw new CustomerValidationError('Company name is required');
  }

  // Validate tier if provided
  if (input.tier && !VALID_TIERS.includes(input.tier)) {
    throw new CustomerValidationError(
      `Invalid tier: ${input.tier}. Must be one of: ${VALID_TIERS.join(', ')}`
    );
  }

  // Validate status if provided
  if (input.status && !VALID_STATUSES.includes(input.status)) {
    throw new CustomerValidationError(
      `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  // Validate healthScore range if provided
  if (input.healthScore !== undefined) {
    if (input.healthScore < 0 || input.healthScore > 100) {
      throw new CustomerValidationError('Health score must be between 0 and 100');
    }
  }

  // Validate contacts array format if provided
  if (input.contacts) {
    if (!Array.isArray(input.contacts)) {
      throw new CustomerValidationError('Contacts must be an array');
    }
    for (const contact of input.contacts as CustomerContact[]) {
      if (!contact.name?.trim()) {
        throw new CustomerValidationError('Each contact must have a name');
      }
      if (!contact.role?.trim()) {
        throw new CustomerValidationError('Each contact must have a role');
      }
      if (contact.email && !isValidEmail(contact.email)) {
        throw new CustomerValidationError(`Invalid email format: ${contact.email}`);
      }
    }
  }
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Create a new customer
 */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  validateCustomerInput(input, true);

  const slug = input.slug || createSlug(input.company);

  const customer = await prisma.customer.create({
    data: {
      slug,
      company: input.company,
      industry: input.industry,
      tier: input.tier,
      healthScore: input.healthScore,
      crmId: input.crmId,
      contacts: (input.contacts || []) as unknown as Prisma.InputJsonValue,
      products: input.products || [],
      summary: input.summary,
      notes: input.notes,
      teamId: input.teamId,
      ownerId: input.ownerId,
      status: input.status || 'ACTIVE',
    },
  });

  return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { id } });
}

/**
 * Get customer by slug
 */
export async function getCustomerBySlug(slug: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { slug } });
}

/**
 * Get customer by CRM ID
 */
export async function getCustomerByCrmId(crmId: string): Promise<Customer | null> {
  return prisma.customer.findUnique({ where: { crmId } });
}

/**
 * Query customers with filters
 */
export async function queryCustomers(
  options: CustomerQueryOptions = {}
): Promise<{ customers: Customer[]; total: number }> {
  const {
    teamId,
    status,
    tier,
    search,
    limit = 50,
    offset = 0,
    orderBy = 'company',
    orderDir = 'asc',
  } = options;

  const where = {
    ...(teamId && { teamId }),
    ...(status && { status }),
    ...(tier && { tier }),
    ...(search && {
      OR: [
        { company: { contains: search, mode: 'insensitive' as const } },
        { summary: { contains: search, mode: 'insensitive' as const } },
        { notes: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    // Show all customers - use status field for filtering (ACTIVE, CHURNED, PROSPECT)
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [orderBy]: orderDir },
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total };
}

/**
 * Update customer
 */
export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer> {
  validateCustomerInput(input, false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = input;
  if (input.contacts) {
    data.contacts = input.contacts as unknown as Prisma.InputJsonValue;
  }
  return prisma.customer.update({
    where: { id },
    data,
  });
}

/**
 * Soft delete customer (sets isActive=false)
 */
export async function deleteCustomer(id: string): Promise<void> {
  await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });
}

/**
 * Get customer's skills
 */
export async function getCustomerSkills(customerId: string) {
  return prisma.buildingBlock.findMany({
    where: {
      libraryId: 'customers',
      customerId,
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get customer's staged sources
 */
export async function getCustomerSources(customerId: string) {
  return prisma.stagedSource.findMany({
    where: { customerId },
    orderBy: { stagedAt: 'desc' },
    include: {
      assignments: {
        where: { incorporatedAt: { not: null } },
        include: {
          block: {
            select: { id: true, title: true, slug: true },
          },
        },
      },
    },
  });
}

/**
 * Get customer's generated views
 */
export async function getCustomerGeneratedViews(customerId: string) {
  return prisma.generatedView.findMany({
    where: { customerId },
    orderBy: { generatedAt: 'desc' },
  });
}

/**
 * Check if a user can access a customer (via team membership or ownership)
 */
export async function canAccessCustomer(
  userId: string,
  customerId: string
): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { teamId: true, ownerId: true },
  });

  if (!customer) return false;

  // Owner always has access
  if (customer.ownerId === userId) return true;

  // If no team, only owner has access
  if (!customer.teamId) return false;

  // Check team membership
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: { userId, teamId: customer.teamId },
    },
  });

  return !!membership;
}

/**
 * Check if a user can manage (edit/delete) a customer
 */
export async function canManageCustomer(
  userId: string,
  customerId: string
): Promise<boolean> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { teamId: true, ownerId: true },
  });

  if (!customer) return false;

  // Owner always has management access
  if (customer.ownerId === userId) return true;

  // If no team, only owner can manage
  if (!customer.teamId) return false;

  // Check for admin or member role in team
  const membership = await prisma.teamMembership.findUnique({
    where: {
      userId_teamId: { userId, teamId: customer.teamId },
    },
  });

  // Only admin and member roles can manage (viewers cannot)
  return membership?.role === 'admin' || membership?.role === 'member';
}
