# Database migrations (Platform V2, clean baseline)

## TL;DR reset flow
1) Drop/create the database (data wipe).
2) `npx prisma migrate deploy` (applies the v2 baseline in `prisma/migrations/20260115000000_init_v2`).
3) `npx prisma db seed` (runs `prisma/seed-minimal.ts`, creates only the default team).
4) Start the app; Okta SSO logins will create users and add them to the default team (role set by auth callbacks).

## Notes
- No sample data is seeded; only the `default` team is created.
- Legacy v1 scripts (`scripts/grant-admin.js`, `scripts/fix-admin.sql`) target the old schema and should not be run.
- The GitHub Actions deploy pipeline runs `npx prisma migrate deploy` followed by `npx prisma db seed` via `scripts/run-migrations.js`, so the default team is always present after deployments.
- Okta is expected for production. Ensure `OKTA_CLIENT_ID/SECRET/ISSUER` are set before deploy.
