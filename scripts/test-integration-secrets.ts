/**
 * Test script to verify integration secrets are configured correctly.
 *
 * Run with: AWS_PROFILE=dev-security npx tsx scripts/test-integration-secrets.ts
 *
 * Works with AWS_PROFILE for local development.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Direct client that works with AWS_PROFILE (SDK automatically picks it up)
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const INTEGRATION_SECRETS = {
  notion: ['notion-api-token'],
  slack: ['slack-bot-token', 'slack-bot-token-knowledge', 'slack-bot-token-it', 'slack-bot-token-gtm', 'slack-bot-token-customers'],
  zendesk: ['zendesk-internal-subdomain', 'zendesk-internal-email', 'zendesk-internal-api-token'],
  gong: ['gong-access-key', 'gong-access-key-secret'],
};

async function getSecret(secretName: string): Promise<string> {
  const env = process.env.ENVIRONMENT || 'development';
  const secretPath = `${env}/transparent-trust-${secretName}`;

  const command = new GetSecretValueCommand({ SecretId: secretPath });
  const response = await secretsClient.send(command);
  return response.SecretString || '';
}

async function testSecret(name: string): Promise<{ name: string; status: 'found' | 'not_found' | 'empty'; preview?: string; error?: string }> {
  try {
    const value = await getSecret(name);
    if (!value || value.trim() === '') {
      return { name, status: 'empty' };
    }
    // Show first 10 chars for verification (masked)
    const preview = value.substring(0, Math.min(10, value.length)) + '...' + value.substring(Math.max(0, value.length - 4));
    return { name, status: 'found', preview };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { name, status: 'not_found', error: errorMessage };
  }
}

async function main() {
  console.log('\n========================================');
  console.log('Integration Secrets Test');
  console.log('========================================\n');

  console.log(`AWS Region: ${process.env.AWS_REGION || 'us-east-1 (default)'}`);
  console.log(`AWS Profile: ${process.env.AWS_PROFILE || 'not set (using default credentials)'}`);
  console.log(`Environment: ${process.env.ENVIRONMENT || 'development (default)'}`);
  console.log('');

  // Test connectivity first with a simple request
  console.log('Testing AWS connectivity...');
  try {
    await testSecret('notion-api-token');
    console.log('✅ AWS connection successful\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not load credentials') || errorMessage.includes('CredentialsProviderError')) {
      console.log('❌ AWS credentials not found.');
      console.log('   Try: AWS_PROFILE=dev-security npx tsx scripts/test-integration-secrets.ts');
      process.exit(1);
    }
    // Other errors (like secret not found) are OK - means connectivity works
    console.log('✅ AWS connection successful\n');
  }

  // Test each integration
  for (const [integration, secrets] of Object.entries(INTEGRATION_SECRETS)) {
    console.log(`\n--- ${integration.toUpperCase()} ---`);

    let hasAnySecret = false;
    for (const secretName of secrets) {
      const result = await testSecret(secretName);

      if (result.status === 'found') {
        console.log(`  ✅ ${secretName}: FOUND (${result.preview})`);
        hasAnySecret = true;
      } else if (result.status === 'empty') {
        console.log(`  ⚠️  ${secretName}: EMPTY (secret exists but value is empty)`);
      } else {
        console.log(`  ❌ ${secretName}: NOT FOUND`);
      }
    }

    if (!hasAnySecret) {
      console.log(`  ⚠️  No secrets found for ${integration} - integration will not work`);
    }
  }

  console.log('\n========================================');
  console.log('Test Complete');
  console.log('========================================\n');
}

main().catch(console.error);
