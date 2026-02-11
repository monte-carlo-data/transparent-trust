-- Legacy v1 script (AuthGroupMapping/capabilities). Do NOT run on the v2 schema.
-- Grant ADMIN to a specific user (update email below)
UPDATE "User"
SET capabilities = ARRAY['ADMIN']::text[],
    role = 'ADMIN'
WHERE email = 'admin@example.com';

-- Delete tt-* groups
DELETE FROM "AuthGroupMapping" WHERE "groupId" LIKE 'tt-%';

-- Add Security and Compliance
INSERT INTO "AuthGroupMapping" (id, provider, "groupId", "groupName", capabilities, "isActive", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'okta', 'Security', 'Security Team', ARRAY['ADMIN']::text[], true, NOW(), NOW()),
  (gen_random_uuid(), 'okta', 'Compliance', 'Compliance Team', ARRAY['ADMIN']::text[], true, NOW(), NOW())
ON CONFLICT (provider, "groupId") DO UPDATE 
SET capabilities = ARRAY['ADMIN']::text[], "isActive" = true, "updatedAt" = NOW();
