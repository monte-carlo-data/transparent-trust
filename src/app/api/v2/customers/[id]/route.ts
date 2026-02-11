/**
 * GET /api/v2/customers/[id] - Get customer by ID
 * PATCH /api/v2/customers/[id] - Update customer
 * DELETE /api/v2/customers/[id] - Delete customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import {
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  canAccessCustomer,
  canManageCustomer,
  CustomerValidationError,
} from '@/lib/v2/customers/customer-service';
import type { UpdateCustomerInput } from '@/types/v2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check access permission
    const hasAccess = await canAccessCustomer(session.user.id, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const customer = await getCustomerById(id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check management permission
    const canManage = await canManageCustomer(session.user.id, id);
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to update this customer' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input: UpdateCustomerInput = body;

    const customer = await updateCustomer(id, input);

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error instanceof CustomerValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check management permission
    const canManage = await canManageCustomer(session.user.id, id);
    if (!canManage) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this customer' },
        { status: 403 }
      );
    }

    await deleteCustomer(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
