# Document Templates (Git-First Architecture)

This directory contains document templates as the source of truth for collateral generation.

## Directory Structure

```
templates/
├── README.md                    # This file
├── .gitignore                   # Ignores .templates/ cache
└── {slug}.md                    # Individual template files
```

## File Format

Templates are markdown files with YAML frontmatter:

```markdown
---
id: template-uuid-here
slug: sales-battlecard
name: Sales Battlecard
description: Standard competitive battlecard for sales teams
category: Sales
outputFormat: markdown
instructionPresetId: preset-uuid-or-null
placeholderMappings:
  - placeholder: customerName
    source: customer
    field: name
  - placeholder: industry
    source: customer
    field: industry
  - placeholder: competitorStrengths
    source: llm
    llmInstruction: "List 3 key competitor strengths based on the customer's industry"
isActive: true
sortOrder: 0
created: 2025-01-01T00:00:00.000Z
updated: 2025-01-01T00:00:00.000Z
createdBy: user@example.com
updatedBy: user@example.com
---

# {{customerName}} Battlecard

## Customer Overview
{{customerOverview}}

## Industry Context: {{industry}}
{{industryContext}}

## Competitor Analysis
### Strengths
{{competitorStrengths}}

### Weaknesses
{{competitorWeaknesses}}

## Our Differentiation
{{differentiators}}

## Key Talking Points
{{talkingPoints}}

## Objection Handling
{{objectionHandling}}
```

## Placeholder Mappings

Templates use `{{placeholder}}` syntax. Each placeholder should be mapped in the frontmatter:

### Source Types

| Source | Description | Required Fields |
|--------|-------------|-----------------|
| `customer` | Pull from selected customer profile | `field` (customer property name) |
| `skill` | Pull from selected skill | `field` (skill property), `skillCategory` (optional) |
| `llm` | Generate via LLM | `llmInstruction` (prompt for AI) |
| `input` | User provides directly | `fallback` (default value) |
| `static` | Fixed value | `value` |

### Example Mappings

```yaml
placeholderMappings:
  # From customer profile
  - placeholder: customerName
    source: customer
    field: name

  # From skills (first matching skill in category)
  - placeholder: securityFeatures
    source: skill
    field: content
    skillCategory: Security

  # LLM-generated based on context
  - placeholder: talkingPoints
    source: llm
    llmInstruction: "Generate 5 key talking points for this customer"

  # User input with default
  - placeholder: dealSize
    source: input
    fallback: "Enterprise"

  # Static value
  - placeholder: companyName
    source: static
    value: "Acme Corp"
```

## Categories

Suggested categories for organizing templates:

- **Sales**: Battlecards, one-pagers, proposals
- **Marketing**: Case studies, product briefs
- **Technical**: Architecture docs, security whitepapers
- **Internal**: Process docs, runbooks

## How It Works

1. **Editing Templates**: Users can edit templates in the web UI or directly in git
2. **Syncing to Database**: Run `npm run sync:templates` to sync git → database
3. **App Changes**: When templates are edited in the app, they commit to git
4. **Export**: Run `npm run export:templates` to export database → git (for migration)

## Common Tasks

### View All Templates
```bash
ls -la templates/
```

### View a Specific Template
```bash
cat templates/sales-battlecard.md
```

### Sync After Git Changes
```bash
npm run sync:templates
```

### Export Database to Git
```bash
npm run export:templates
```

## Best Practices

1. Use clear, descriptive template names
2. Document all placeholders in the template content
3. Provide sensible defaults for input placeholders
4. Test templates with various customer profiles
5. Use categories consistently for organization
