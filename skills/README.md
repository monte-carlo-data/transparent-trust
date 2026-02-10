# Skills Directory

This directory contains all knowledge base skills in markdown format with YAML frontmatter.

## Structure

- Each skill is a separate `.md` file
- Filename format: `{slug}.md` (e.g., `compliance-and-certifications.md`)
- Files contain YAML frontmatter with metadata + markdown content

## File Format

```markdown
---
id: uuid
title: Skill Title
categories: [Category1, Category2]
created: ISO 8601 timestamp
updated: ISO 8601 timestamp
owners:
  - name: Owner Name
    email: owner@example.com
    userId: optional-user-id
sources:
  - url: https://example.com/doc
    addedAt: ISO 8601 timestamp
    lastFetched: ISO 8601 timestamp (optional)
active: true
---

# Skill Title

## Overview
Content goes here...

## Common Questions
**Q: Question?**
A: Answer...

## Edge Cases & Limitations
- Limitation 1
- Limitation 2
```

## Sync Process

**Web UI → Git**: When skills are created/updated via the web interface, changes are automatically committed to this directory.

**Git → Database**: When skills are edited directly in git (via GitHub PR or local edit), run:
```bash
npm run sync:skills
```

This syncs changes back to the PostgreSQL database (cache).

## Git Workflow

### For Most Users (Web UI)
1. Edit skill in web interface
2. Click "Save"
3. Automatically committed to git behind the scenes

### For Engineers (Direct Git)
1. Edit `.md` file in this directory
2. Commit and push (or open PR)
3. After merge, run `npm run sync:skills` (or via GitHub Action)
4. Changes appear in web UI

## Review System

Skills can optionally require review before publishing. This is configured via the admin UI and is **disabled by default**.

When enabled:
- Skills are saved as drafts
- Reviewers must approve before publishing
- Review status tracked in database

See [docs/REVIEW_TOGGLE_DESIGN.md](../docs/REVIEW_TOGGLE_DESIGN.md) for details.

## Migration

To export existing skills from the database to git:
```bash
npm run export:skills
```

This is a one-time operation to migrate from database-first to git-first storage.
