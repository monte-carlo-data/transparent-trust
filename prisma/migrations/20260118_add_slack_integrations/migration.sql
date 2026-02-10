-- Migration: Add Slack integration connections
-- Creates IntegrationConnection records for each library so users can configure channels via UI

-- Insert Slack integration connections for each library
-- These records allow the SlackSourceWizard UI to save selected channels
INSERT INTO "IntegrationConnection" (id, "integrationType", name, status, config, "createdAt", "updatedAt")
VALUES
  ('slack-it', 'slack', 'IT Support Slack', 'ACTIVE', '{"channels": []}', NOW(), NOW()),
  ('slack-knowledge', 'slack', 'Knowledge Slack', 'ACTIVE', '{"channels": []}', NOW(), NOW()),
  ('slack-gtm', 'slack', 'GTM Slack', 'ACTIVE', '{"channels": []}', NOW(), NOW()),
  ('slack-customers', 'slack', 'Customers Slack', 'ACTIVE', '{"channels": []}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
