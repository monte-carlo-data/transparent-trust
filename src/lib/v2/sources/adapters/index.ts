/**
 * Discovery Adapters Index
 *
 * Export all adapters and register them in the registry.
 */

export * from './base-adapter';
export * from './url-adapter';
export * from './zendesk-adapter';
export * from './slack-adapter';
export * from './notion-adapter';
export * from './gong-adapter';
export * from './document-adapter';
export * from './looker-adapter';

// Import adapters for registration
import { urlAdapter } from './url-adapter';
import { zendeskAdapter } from './zendesk-adapter';
import { slackAdapter } from './slack-adapter';
import { notionAdapter } from './notion-adapter';
import { gongAdapter } from './gong-adapter';
import { documentAdapter } from './document-adapter';
import { lookerAdapter } from './looker-adapter';
import { registerAdapter } from './base-adapter';
import type { TypedStagedSource } from '@/types/v2';
import type { BaseDiscoveryAdapter } from './base-adapter';

// Register all adapters
registerAdapter(urlAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(zendeskAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(slackAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(notionAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(gongAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(documentAdapter as BaseDiscoveryAdapter<TypedStagedSource>);
registerAdapter(lookerAdapter as BaseDiscoveryAdapter<TypedStagedSource>);

// Export individual adapters for direct use
export const adapters = {
  url: urlAdapter,
  zendesk: zendeskAdapter,
  slack: slackAdapter,
  notion: notionAdapter,
  gong: gongAdapter,
  document: documentAdapter,
  looker: lookerAdapter,
} as const;
