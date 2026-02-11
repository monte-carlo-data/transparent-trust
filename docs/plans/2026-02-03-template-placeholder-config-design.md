# Template Placeholder Configuration Design

## Overview

Add a UI for configuring Google Slides templates with placeholder definitions. This enables the collateral generation flow where templates define placeholders (`{{...}}`), users provide source materials (skills + raw customer sources), and the LLM generates values to fill into Google Slides.

## Architecture

### Component Responsibilities

| Component | Responsibility | Editable By |
|-----------|----------------|-------------|
| **Persona** | Tone, audience, style ("executive business language for C-suite") | Users (easy) |
| **Template content** | Domain instructions (Purpose, Extraction Framework, Quality Standards) | Users (medium) |
| **Template placeholders** | `{{...}}` definitions with descriptions | Users (easy) |
| **Prompt composition** | Generic collateral generation format (JSON output mechanics) | Engineers (rare) |
| **Skills** | Distilled domain knowledge (company capabilities, customer intelligence) | Users (via skill system) |
| **Customer Sources** | Raw input materials (Gong transcripts, Slack threads, documents) | Users (via source staging) |

### Generation Flow

```
┌─────────────────────────────────────────┐
│  CONTEXT (selected in KnowledgeBar)     │
├─────────────────────────────────────────┤
│  Skills (distilled knowledge)           │
│  + Customer Sources (raw transcripts)   │
└─────────────────────────────────────────┘
                    ↓
         Template content (domain instructions)
                    ↓
         Placeholder guide (what each {{...}} should contain)
                    ↓
         Persona (tone/style)
                    ↓
         LLM → JSON with placeholder values
                    ↓
         Google Slides export
```

## Data Model

### TemplateAttributes Extension

```typescript
interface TemplateAttributes {
  // Existing fields...

  // Google Slides integration
  outputType?: 'text' | 'google-slides';
  googleSlidesTemplateId?: string;

  // Placeholder configuration
  placeholderGuide?: Record<string, string>;  // { "Customer": "Company name", ... }
  detectedPlaceholders?: string[];            // Auto-detected from Slides

  // Optional persona link
  defaultPersonaId?: string;                  // Pre-select a persona when using this template
}
```

## UI Design

### Route: `/v2/templates/[id]/configure`

Full-width page with sections:

#### Header Section
- Template title (editable inline)
- "Back to Templates" link
- "Save" button (top right)

#### Section 1: Basic Settings
| Field | Description |
|-------|-------------|
| **Output Type** | Dropdown: `Text` / `Google Slides` |
| **Google Slides ID** | Text input (shown when output type = Google Slides) - can paste full URL or just ID |
| **Default Persona** | Dropdown to select a persona (optional) |

#### Section 2: Template Instructions
- Large textarea for the template's `content` field
- Holds domain instructions (Purpose, Extraction Framework, Quality Standards, etc.)
- Helper text: "These instructions tell the AI how to analyze the source materials"

#### Section 3: Placeholders

**Toolbar:**
- "Auto-detect from Slides" button (scans Google Slides for `{{...}}` patterns)
- "Bulk Import" button (opens modal with textarea for pasting)
- "Add Placeholder" button (adds single row)

**Table:**
| Placeholder | Description | Actions |
|-------------|-------------|---------|
| `{{Customer}}` | Company name | Delete |
| `{{Goal 1}}` | Primary data initiative in 7 words or fewer | Delete |
| ... | ... | ... |

- Placeholder names are editable inline
- Descriptions are editable inline

**Bulk Import Modal:**
- Textarea accepting format: `{{Name}}[Description]` per line
- Preview parsed results before confirming
- "Import" button adds all to table

Example input:
```
{{Customer}}[Company name]
{{Goal 1}}[Primary data initiative in 7 words or fewer]
{{Goal 1 D}}[Business context and driver in up to 50 words]
```

## API Design

### Existing Endpoints (no changes)
- `GET /api/v2/blocks/[id]` - Fetch template details
- `PATCH /api/v2/blocks/[id]` - Update template (title, content, attributes)

### New Endpoint
- `GET /api/v2/collateral/slides-placeholders?presentationId=...` - Auto-detect placeholders from Google Slides

## Error Handling

| Scenario | Handling |
|----------|----------|
| Invalid Google Slides ID | Inline error: "Could not access this presentation. Check the ID and ensure it's shared with your account." |
| No `{{...}}` placeholders found | Warning: "No placeholders detected. Add them manually or check your Slides template uses `{{name}}` format." |
| Bulk import parse error | Show preview with errors highlighted, allow partial import of valid rows |
| Save fails | Toast error, keep form state |
| No Google auth | Disable auto-detect button, show "Connect Google" link |

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/v2/templates/[id]/configure/page.tsx` | **Create** - Configuration page |
| `src/components/v2/templates/PlaceholderTable.tsx` | **Create** - Editable placeholder table |
| `src/components/v2/templates/BulkImportModal.tsx` | **Create** - Bulk import modal with parser |
| `src/app/api/v2/collateral/slides-placeholders/route.ts` | **Create** - Auto-detect endpoint |
| `src/components/v2/CreateTemplateModal.tsx` | **Modify** - Add Google Slides ID field, redirect to configure page |
| `src/types/v2/building-block.ts` | **Modify** - Add `defaultPersonaId` to TemplateAttributes |

## Implementation Order

1. Add `defaultPersonaId` to TemplateAttributes type
2. Create slides-placeholders API endpoint
3. Create PlaceholderTable component
4. Create BulkImportModal component
5. Create configure page
6. Update CreateTemplateModal to redirect to configure page
