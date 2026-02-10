# Prompt Files (Git-First Architecture)

This directory contains prompt blocks and modifiers as the source of truth for the prompt system.

## Directory Structure

```
prompts/
├── README.md              # This file
├── .gitignore             # Ignores .prompts/ cache
├── blocks/                # Prompt building blocks
│   └── {block-id}.md      # Individual block files
└── modifiers/             # Runtime modifiers (mode/domain)
    └── {modifier-id}.md   # Individual modifier files
```

## File Format

### Block Files (`blocks/*.md`)

Blocks are reusable prompt building blocks that can have context-specific variants.

```markdown
---
id: block_id_here
name: Human Readable Name
description: What this block is for
tier: 1 | 2 | 3
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
updatedBy: user@example.com
---

# Default Variant

Default content used when no context-specific variant exists.

---variant:questions---

Content for the "questions" context.

---variant:skills---

Content for the "skills" context.

---variant:chat---

Content for the "chat" context.

# Add more variants as needed using ---variant:{context}---
```

#### Tier System

- **Tier 1 (Locked)**: Core system blocks - changes may break functionality
- **Tier 2 (Caution)**: Important blocks - can be customized but with care
- **Tier 3 (Open)**: Safe to customize freely - personalization and style

### Modifier Files (`modifiers/*.md`)

Modifiers are runtime additions injected based on user selection.

```markdown
---
id: modifier_id_here
name: Human Readable Name
type: mode | domain
tier: 1 | 2 | 3
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
updatedBy: user@example.com
---

The modifier content goes here as plain markdown.
This is injected when the mode or domain is selected.
```

## How It Works

1. **Editing Prompts**: Engineers can edit markdown files directly in git
2. **Syncing to Database**: Run `npm run sync:prompts` to sync git → database
3. **App Changes**: When prompts are edited in the app, they commit to git
4. **Export**: Run `npm run export:prompts` to export database → git (for migration)

## Common Tasks

### View All Prompt Blocks
```bash
ls -la prompts/blocks/
```

### View a Specific Block
```bash
cat prompts/blocks/role_mission.md
```

### Sync After Git Changes
```bash
npm run sync:prompts
```

### Export Database to Git
```bash
npm run export:prompts
```

## Available Contexts

Blocks can have variants for these contexts:
- `default` - Fallback when no specific variant exists
- `questions` - Answering questionnaires/assessments
- `skills` - Building knowledge skills
- `analysis` - Document analysis
- `chat` - Knowledge chat
- `contracts` - Contract analysis
- `skill_organize` - Organizing skills from sources
- `skill_analyze` - Analyzing URLs/docs
- `skill_refresh` - Refreshing skills
- `skill_analyze_rfp` - Analyzing RFP Q&A
- `skill_planning` - Planning skill creation
- `customer_profile` - Customer profile extraction
- `prompt_optimize` - Prompt optimization
- `instruction_builder` - Chat instruction presets
- `collateral_planning` - Collateral generation planning

## Modifier Types

- `mode` - Processing modes (single, bulk)
- `domain` - Focus areas (technical, legal, security)

## Best Practices

1. Always pull latest before editing prompts
2. Use descriptive commit messages
3. Test prompt changes in staging first
4. Keep variants focused on their context
5. Document significant changes in the file itself
