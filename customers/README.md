# Customer Profiles

This directory contains git-backed customer profile markdown files. Each customer is stored as a single `.md` file with YAML frontmatter for metadata and markdown body for content.

## File Structure

```
customers/
  .gitignore          # Ignores local cache
  .customers/         # Local cache (git-ignored)
  README.md           # This file
  acme-corporation.md # Customer profile
  globex-industries.md
  ...
```

## Customer Profile Format

Each customer profile follows this structure:

```markdown
---
id: 550e8400-e29b-41d4-a716-446655440001
name: Acme Corporation
industry: Healthcare
website: https://acme.com
salesforceId: 0011234567890ABC
region: NA
tier: Enterprise
employeeCount: 5000
annualRevenue: 500000000
accountType: Customer
billingLocation: San Francisco, CA, USA
lastSalesforceSync: 2025-12-19T10:00:00Z
created: 2024-01-10T08:30:00Z
updated: 2025-12-19T14:20:00Z
owners:
  - name: Jane Smith
    email: jane@example.com
    userId: user-123
sources:
  - url: https://acme.com/about
    addedAt: 2024-01-10T08:30:00Z
documents:
  - id: doc-456
    filename: acme-architecture.pdf
    uploadedAt: 2024-06-20T14:00:00Z
considerations:
  - HIPAA-sensitive: Never use real patient data in demos
  - Snowflake-specific focus
active: true
---

# Acme Corporation

## Overview
Company overview goes here...

## Products & Services
- Product 1
- Product 2

## Data Infrastructure
- Primary Data Warehouse: Snowflake
- Streaming: Kafka

## Technical Environment
- Cloud: AWS

## Key Contacts
- Data Engineering Lead: Bob Johnson

## Pain Points & Challenges
- Issue 1
- Issue 2

## Success Metrics
- Metric 1
- Metric 2
```

## Workflows

### Option 1: Web UI (Recommended for Most Users)
1. Open the web application
2. Navigate to Customers
3. Edit customer profile in the rich text editor
4. Click "Save"
5. System automatically commits to git

### Option 2: Direct Git (For Power Users)
```bash
# 1. Clone repo
git clone https://github.com/your-org/transparent-trust.git

# 2. Edit markdown file
vim customers/acme-corporation.md

# 3. Commit and push
git add customers/acme-corporation.md
git commit -m "Update Acme profile: Add new ML use case"
git push origin main

# 4. GitHub Action syncs to database
```

### Option 3: PR Review (For Sensitive Changes)
```bash
# 1. Create branch
git checkout -b update-acme-profile

# 2. Make changes
vim customers/acme-corporation.md

# 3. Create PR
gh pr create --title "Update Acme: Add ML use case"

# 4. Team reviews PR in GitHub
# 5. After approval, merge to main
# 6. GitHub Action syncs to database
```

## Scripts

- `npm run export:customers` - Export all customer profiles from database to git
- `npm run sync:customers` - Sync customer profiles from git to database

## Salesforce Integration

Customer profiles can include Salesforce metadata (salesforceId, region, tier, etc.). The system tracks `lastSalesforceSync` to show when static fields were last synced from Salesforce.

Manual edits to content fields (overview, pain points, etc.) are preserved during Salesforce syncs - only metadata fields are overwritten.

---

Generated: 2025-12-19
Part of Git-First Knowledge Base Architecture
