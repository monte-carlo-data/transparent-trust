/**
 * GET /api/v2/customers - List customers
 * POST /api/v2/customers - Create new customer
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { queryCustomers, createCustomer, CustomerValidationError } from '@/lib/v2/customers/customer-service';
import type { CreateCustomerInput } from '@/types/v2';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const tier = searchParams.get('tier') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Note: Team filtering removed - customers are visible to all authenticated users.
    // Authorization for specific actions (edit, delete) is handled at the action level
    // via canAccessCustomer() and canManageCustomer() in customer-service.ts.
    const result = await queryCustomers({
      // teamId intentionally not passed - list all customers
      search,
      status,
      tier,
      limit,
      offset,
      orderBy: 'company',
      orderDir: 'asc',
    });

    return NextResponse.json({
      customers: result.customers,
      total: result.total,
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team to auto-assign teamId
    const { prisma } = await import('@/lib/prisma');
    const membership = await prisma.teamMembership.findFirst({
      where: { userId: session.user.id },
      select: { teamId: true },
    });

    const body = await request.json();
    const input: CreateCustomerInput = {
      ...body,
      ownerId: session.user.id,
      teamId: body.teamId || membership?.teamId, // Auto-set from user's team if not provided
    };

    const customer = await createCustomer(input);

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    if (error instanceof CustomerValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
