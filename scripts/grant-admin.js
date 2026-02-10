// Legacy v1 script (uses AuthGroupMapping/capabilities) - do NOT run on the v2 schema.
// Grant admin access to a specific user (update email below)
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    // Update your user to have ADMIN capability
    const user = await prisma.user.update({
      where: {
        email: 'admin@example.com'
      },
      data: {
        capabilities: ['ADMIN'],
        role: 'ADMIN'
      }
    });

    console.log('✓ Granted ADMIN access to:', user.email);
    console.log('Capabilities:', user.capabilities);
    console.log('Role:', user.role);

    // Also update the group mappings
    console.log('\nUpdating group mappings...');

    // Delete tt-* groups
    const deleted = await prisma.authGroupMapping.deleteMany({
      where: {
        groupId: {
          startsWith: 'tt-'
        }
      }
    });
    console.log(`✓ Deleted ${deleted.count} tt-* group mappings`);

    // Create Security and Compliance mappings
    const security = await prisma.authGroupMapping.upsert({
      where: {
        provider_groupId: {
          provider: 'okta',
          groupId: 'Security'
        }
      },
      create: {
        provider: 'okta',
        groupId: 'Security',
        groupName: 'Security Team',
        capabilities: ['ADMIN'],
        isActive: true
      },
      update: {
        capabilities: ['ADMIN'],
        isActive: true
      }
    });
    console.log('✓ Created Security → ADMIN mapping');

    const compliance = await prisma.authGroupMapping.upsert({
      where: {
        provider_groupId: {
          provider: 'okta',
          groupId: 'Compliance'
        }
      },
      create: {
        provider: 'okta',
        groupId: 'Compliance',
        groupName: 'Compliance Team',
        capabilities: ['ADMIN'],
        isActive: true
      },
      update: {
        capabilities: ['ADMIN'],
        isActive: true
      }
    });
    console.log('✓ Created Compliance → ADMIN mapping');

    console.log('\n✓ All done! Refresh your browser to get admin access.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
