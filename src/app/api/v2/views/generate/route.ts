import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { getOrGenerateViewOutput } from '@/lib/v2/views';
import { prisma } from '@/lib/prisma';
import { canAccessCustomer } from '@/lib/v2/customers/customer-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/v2/views/generate
 * Generate or refresh view output for a customer
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viewId, customerId, forceRefresh, libraryId, skillIds } = await request.json();

    if (!viewId || !customerId) {
      return NextResponse.json({ error: 'viewId and customerId required' }, { status: 400 });
    }

    // Get customer from Customer table (not BuildingBlock)
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Check authorization
    const hasAccess = await canAccessCustomer(session.user.id, customerId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get customer skills (BuildingBlocks with customerId)
    // If skillIds is provided (array), filter to only those skills
    // If skillIds is undefined, include all skills
    // If skillIds is empty array, include no skills
    const skillsWhere: { customerId: string; status: string; libraryId: string; id?: { in: string[] } } = {
      customerId,
      status: 'ACTIVE',
      libraryId: 'customers',
    };
    if (Array.isArray(skillIds)) {
      skillsWhere.id = { in: skillIds };
    }
    const skills = await prisma.buildingBlock.findMany({
      where: skillsWhere,
      select: {
        id: true,
        title: true,
        content: true,
        summary: true,
      },
    });

    // Build customer attributes for the view
    const customerAttributes = {
      company: customer.company,
      industry: customer.industry,
      tier: customer.tier,
      healthScore: customer.healthScore,
      products: customer.products,
      contacts: customer.contacts,
      crmId: customer.crmId,
    };

    const result = await getOrGenerateViewOutput(
      viewId,
      customerId,
      {
        title: customer.company,
        attributes: customerAttributes,
        skills: skills as Array<{ id: string; title: string; content?: string; summary?: string }>,
      },
      forceRefresh,
      libraryId
    );

    // Return both the generated view and transparency data if available
    return NextResponse.json({
      content: result.content,
      generatedAt: result.generatedAt,
      title: result.title,
      transparency: 'transparency' in result ? result.transparency : undefined,
    });
  } catch (error) {
    logger.error('Error generating view', { error });

    if (error instanceof Error) {
      if (error.message === 'View not found') {
        return NextResponse.json({ error: 'View not found' }, { status: 404 });
      }
      if (error.message.includes('Unknown composition')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate view' },
      { status: 500 }
    );
  }
}
