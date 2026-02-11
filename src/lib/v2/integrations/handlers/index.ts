/**
 * V2 Integration Handlers
 *
 * Re-exports all handler instances for convenient importing.
 */

export { BaseSourceHandler } from './base-handler';
export { slackHandler, SlackSourceHandler, type SlackDiscoveredItem } from './slack-handler';
export { zendeskHandler, ZendeskSourceHandler, type ZendeskDiscoveredItem } from './zendesk-handler';
export { gongHandler, GongSourceHandler, type GongDiscoveredItem } from './gong-handler';
export { notionHandler, NotionSourceHandler, type NotionDiscoveredItem } from './notion-handler';
