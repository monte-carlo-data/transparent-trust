# Implementation Plan: Skill Type & Schema Cleanup

## Overview

Add `skillType` to differentiate knowledge vs intelligence skills, and clean up redundant schema fields.

## Schema Changes Summary

| Action | Field | Details |
|--------|-------|---------|
| **ADD** | `skillType` | `VARCHAR NOT NULL DEFAULT 'knowledge'` - values: `'knowledge'`, `'intelligence'` |
| **DROP** | `isActive` | Redundant with `status` |
| **DROP** | `tier` | Always `'library'`, unused |
| **CHANGE** | `status` default | `'DRAFT'` → `'ACTIVE'` |

## Attributes Changes (No Migration)

- Add `exposedTo: string[]` to attributes for feature access control (UI configurable)

---

## Phase 1: Database Migration

### Task 1.1: Create Migration File

Create `prisma/migrations/[timestamp]_skill_type_schema_cleanup/migration.sql`:

```sql
-- Add skillType column
ALTER TABLE "BuildingBlock" ADD COLUMN "skillType" VARCHAR NOT NULL DEFAULT 'knowledge';

-- Backfill: foundational skills → 'intelligence'
UPDATE "BuildingBlock"
SET "skillType" = 'intelligence'
WHERE (attributes->>'isFoundational')::boolean = true
  AND "customerId" IS NULL;

-- Change status default from DRAFT to ACTIVE
ALTER TABLE "BuildingBlock" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Migrate isActive=false to status='ARCHIVED'
UPDATE "BuildingBlock"
SET "status" = 'ARCHIVED'
WHERE "isActive" = false;

-- Drop isActive column
ALTER TABLE "BuildingBlock" DROP COLUMN "isActive";

-- Drop tier column
ALTER TABLE "BuildingBlock" DROP COLUMN "tier";

-- Add index for skillType queries
CREATE INDEX "BuildingBlock_skillType_idx" ON "BuildingBlock"("skillType");

-- Update existing index to include skillType instead of tier
DROP INDEX IF EXISTS "BuildingBlock_blockType_libraryId_status_idx";
CREATE INDEX "BuildingBlock_blockType_libraryId_status_skillType_idx"
  ON "BuildingBlock"("blockType", "libraryId", "status", "skillType");
```

### Task 1.2: Update Prisma Schema

Edit `prisma/schema.prisma` - BuildingBlock model:

**Remove:**
```prisma
isActive    Boolean  @default(true)
tier        String   @default("library")
```

**Add:**
```prisma
skillType   String   @default("knowledge") // 'knowledge' | 'intelligence'
```

**Change:**
```prisma
status      String   @default("ACTIVE") // 'ACTIVE', 'ARCHIVED' (removed DRAFT)
```

**Update indexes:**
```prisma
@@index([blockType, libraryId, status, skillType])
@@index([skillType])
```

---

## Phase 2: TypeScript Types

### Task 2.1: Update BuildingBlock Types

Edit `src/types/v2/building-block.ts`:

**Add skill type definition (after line ~151):**
```typescript
export const SKILL_TYPES = ['knowledge', 'intelligence'] as const;
export type SkillType = (typeof SKILL_TYPES)[number];
```

**Update BLOCK_STATUSES (remove DRAFT):**
```typescript
export const BLOCK_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
```

**Add to base block interface:**
```typescript
skillType: SkillType;
```

**Remove from interfaces:**
- `isActive: boolean`
- `tier: string`

**Add type guards:**
```typescript
export function getSkillType(block: AnyBlock): SkillType {
  return block.skillType === 'intelligence' ? 'intelligence' : 'knowledge';
}

export function isKnowledgeTypeSkill(block: AnyBlock): boolean {
  return getSkillType(block) === 'knowledge';
}

export function isIntelligenceTypeSkill(block: AnyBlock): boolean {
  return getSkillType(block) === 'intelligence';
}
```

**Add exposedTo to BaseKnowledgeAttributes:**
```typescript
exposedTo?: string[]; // Feature access: ['slackbot', 'chat', 'rfp']
```

---

## Phase 3: Prompt Architecture

### Task 3.1: Create Type-Specific Content Structure Blocks

Edit `src/lib/v2/prompts/blocks/skill-output-blocks.ts`:

**Replace `skillContentStructureBlock` with two blocks:**

```typescript
export const knowledgeContentStructureBlock: PromptBlock = {
  id: 'knowledge_content_structure',
  name: 'Knowledge Skill Content Structure',
  description: 'Required sections for knowledge-type skills.',
  tier: 1,
  content: `KNOWLEDGE SKILL STRUCTURE:

Your "content" field MUST include these sections:

1. **Main Skill Body** (Opening section)
   - Comprehensive facts, specifications, and details extracted from sources
   - Inline citations [1], [2], [3] placed after facts
   - Well-organized with subsections if needed (use ### headers)
   - Include all important lists, numbers, versions, capabilities
   - Complete lists - never "X, Y, Z, and more" - list everything

2. **## Common Questions** (REQUIRED for knowledge skills)
   - List the most important questions this skill answers
   - Include brief answers for each
   - Can be 1-2 for narrow topics, 8-10 for broad topics
   - If source materials include Q&A sections, include them verbatim
   - Format:
     **Q: What is X?**
     A: [Answer with citation if needed]

3. **## Scope Definition** (Required section)
   - "covers": What this skill currently covers (1-2 sentences)
   - "futureAdditions": Types of content to add later (specific items)
   - "notIncluded": What should explicitly NOT be in this skill

4. **## Sources** (Required section)
   - List each source with its citation number
   - Format: "[1] Source Label"`,
};

export const intelligenceContentStructureBlock: PromptBlock = {
  id: 'intelligence_content_structure',
  name: 'Intelligence Skill Content Structure',
  description: 'Required sections for intelligence-type skills (no Q&A).',
  tier: 1,
  content: `INTELLIGENCE SKILL STRUCTURE:

Intelligence skills focus on narrative context and insights, NOT Q&A format.

Your "content" field MUST include these sections:

1. **Main Skill Body** (Opening section)
   - Narrative synthesis of context, insights, and intelligence
   - Inline citations [1], [2], [3] placed after facts
   - Well-organized with subsections if needed (use ### headers)
   - Focus on storytelling, context, relationships, and strategic insights
   - Complete information - never truncate lists or details

2. **## Scope Definition** (Required section)
   - "covers": What this skill currently covers (1-2 sentences)
   - "futureAdditions": Types of content to add later (specific items)
   - "notIncluded": What should explicitly NOT be in this skill

3. **## Sources** (Required section)
   - List each source with its citation number
   - Format: "[1] Source Label"

IMPORTANT: Intelligence skills do NOT include a Common Questions section.
Focus on narrative synthesis and contextual intelligence instead.`,
};
```

**Update exports array:**
```typescript
export const skillOutputBlocks: PromptBlock[] = [
  knowledgeContentStructureBlock,
  intelligenceContentStructureBlock,
  skillCommonQuestionsRequirementBlock, // Only used for knowledge type
  skillCitationEmbeddingBlock,
  skillListCompletenessBlock,
  skillVersioningBlock,
  skillUpdateBlock,
  skillRefreshBlock,
];
```

### Task 3.2: Update Skill Compositions

Edit `src/lib/v2/prompts/compositions/skill-compositions.ts`:

**Add helper function:**
```typescript
import type { SkillType } from '@/types/v2';

function getContentStructureBlocks(skillType: SkillType): string[] {
  if (skillType === 'intelligence') {
    return ['intelligence_content_structure'];
  }
  return ['knowledge_content_structure', 'skill_common_questions_requirement'];
}
```

**Update skill creation composition to accept skillType:**
```typescript
export function getSkillCreationComposition(skillType: SkillType = 'knowledge'): PromptComposition {
  const baseBlocks = [
    'role_skill_creation',
    'task_framing_creation',
    'skill_principles',
    'source_fidelity',
    'citation_format',
    'skill_citation_embedding',
    'skill_list_completeness',
    'scope_definition',
    'contradiction_detection',
    'json_output',
  ];

  return {
    context: 'skill_creation',
    name: 'Skill Creation',
    description: `Create new ${skillType} skill from sources`,
    blockIds: [...baseBlocks, ...getContentStructureBlocks(skillType)],
    outputFormat: 'json',
    outputSchema: skillCreationSchema,
  };
}
```

**Similarly update:**
- `getSkillUpdateComposition(skillType)`
- `getSkillFormatRefreshComposition(skillType)`

### Task 3.3: Update Foundational Compositions

Edit `src/lib/v2/prompts/compositions/foundational-compositions.ts` (if exists) or create it:

Foundational skills should always use `intelligence_content_structure` block.

---

## Phase 4: Service Layer

### Task 4.1: Update Skill Generation Service

Edit `src/lib/v2/skills/skill-generation-service.ts`:

**Update CreateSkillInput interface:**
```typescript
export interface CreateSkillInput {
  sources: Array<{...}>;
  libraryId: LibraryId;
  skillType: SkillType; // NEW - required
  // ... rest
}
```

**Update generateSkill function:**
```typescript
export async function generateSkill(input: CreateSkillInput): Promise<SkillCreationOutput> {
  // Get type-specific composition
  const composition = getSkillCreationComposition(input.skillType);

  // Build prompt using composition
  const prompt = buildPromptFromComposition(composition, {
    libraryId: input.libraryId,
    // ...
  });

  // ... rest of function
}
```

### Task 4.2: Update Skill Orchestrator

Edit `src/lib/v2/skills/skill-orchestrator.ts`:

**Update CreateSkillInput:**
```typescript
interface CreateSkillInput extends BaseSkillInput {
  sources: Array<{...}>;
  creationMode: CreationMode;
  skillType?: SkillType; // Optional - derived if not provided
  // ...
}
```

**Update createSkill function:**
```typescript
export async function createSkill(input: CreateSkillInput): Promise<...> {
  // Derive skillType: foundational → intelligence, others → knowledge
  const skillType: SkillType = input.skillType ||
    (input.creationMode === 'foundational' ? 'intelligence' : 'knowledge');

  if (input.creationMode === 'foundational') {
    return generateFoundationalSkill({
      ...input,
      skillType: 'intelligence', // Always intelligence for foundational
    });
  } else {
    return generateStandardSkill({
      ...input,
      skillType,
    });
  }
}
```

### Task 4.3: Update Foundational Service

Edit `src/lib/v2/skills/modes/foundational-service.ts`:

Update to use `intelligence_content_structure` block explicitly.

### Task 4.4: Update Template Service

Edit `src/lib/v2/skills/template-service.ts`:

**Update cloneFoundationalSkill (around line 163):**
```typescript
const cloned = await prisma.buildingBlock.create({
  data: {
    title: sourceSkill.title,
    slug,
    content: '',
    summary: `${sourceSkill.title} for ${customer.company || 'this customer'}`,
    libraryId: 'customers' as LibraryId,
    customerId,
    blockType: 'knowledge',
    skillType: 'intelligence', // NEW - cloned foundational skills are intelligence type
    status: 'ACTIVE', // CHANGED - was 'DRAFT'
    // REMOVED: isActive: true,
    // REMOVED: tier: 'library',
    teamId: sourceSkill.teamId,
    ownerId: input.userId,
    attributes: clonedAttributes as Prisma.InputJsonValue,
  },
});
```

---

## Phase 5: API Layer

### Task 5.1: Update Skills Create Endpoint

Edit `src/app/api/v2/skills/create/route.ts`:

**Add skillType validation:**
```typescript
import { SKILL_TYPES, type SkillType } from '@/types/v2';

// In validation:
const skillType = (body.skillType as SkillType) || 'knowledge';
if (!SKILL_TYPES.includes(skillType)) {
  return NextResponse.json(
    { error: `Invalid skillType. Must be one of: ${SKILL_TYPES.join(', ')}` },
    { status: 400 }
  );
}
```

**Update create call:**
```typescript
const skill = await prisma.buildingBlock.create({
  data: {
    // ...
    skillType,
    status: 'ACTIVE', // Changed default
    // REMOVED: isActive, tier
  },
});
```

### Task 5.2: Update Skills Generate Endpoint

Edit `src/app/api/v2/skills/generate/route.ts`:

**Accept skillType in request:**
```typescript
const { sourceIds, libraryId, skillType = 'knowledge', ... } = await request.json();
```

**Pass to generation service:**
```typescript
const result = await generateSkill({
  sources,
  libraryId,
  skillType,
  // ...
});
```

### Task 5.3: Update Block Service

Edit `src/lib/v2/blocks/block-service.ts`:

**Remove references to `isActive` and `tier`.**

**Add `skillType` to create/update operations.**

---

## Phase 6: UI Changes

### Task 6.1: Update CreateSkillModal

Edit `src/components/v2/CreateSkillModal.tsx`:

**Add state:**
```typescript
const [skillType, setSkillType] = useState<SkillType>('knowledge');
```

**Add UI (radio group):**
```tsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Skill Type
  </label>
  <div className="space-y-2">
    <label className="flex items-center">
      <input
        type="radio"
        value="knowledge"
        checked={skillType === 'knowledge'}
        onChange={() => setSkillType('knowledge')}
        disabled={isFoundational}
        className="mr-2"
      />
      <span className="text-sm">
        <strong>Knowledge</strong> - Q&A format, how-to content, reference material
      </span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        value="intelligence"
        checked={skillType === 'intelligence'}
        onChange={() => setSkillType('intelligence')}
        disabled={isFoundational}
        className="mr-2"
      />
      <span className="text-sm">
        <strong>Intelligence</strong> - Narrative context, insights, account intelligence
      </span>
    </label>
  </div>
  {isFoundational && (
    <p className="text-xs text-gray-500 mt-1">
      Foundational skills are automatically intelligence type
    </p>
  )}
</div>
```

**Auto-set for foundational:**
```typescript
useEffect(() => {
  if (isFoundational) {
    setSkillType('intelligence');
  }
}, [isFoundational]);
```

**Include in payload:**
```typescript
const payload = {
  libraryId,
  title,
  content,
  skillType: isFoundational ? 'intelligence' : skillType,
  // ...
};
```

### Task 6.2: Add exposedTo UI (Optional - can be Phase 2)

Add checkboxes to skill edit page for feature access:
- [ ] Slackbot
- [ ] Chat
- [ ] RFP

This can be done later as a separate task.

---

## Phase 7: Code Cleanup

### Task 7.1: Remove isActive References

Search and replace across codebase:
- Remove `isActive` from all queries
- Remove `isActive` from all type definitions
- Update any `where: { isActive: true }` to `where: { status: 'ACTIVE' }`

**Files to check:**
- `src/lib/v2/skills/*.ts`
- `src/lib/v2/blocks/*.ts`
- `src/app/api/v2/**/*.ts`
- `src/hooks/*.ts`
- `src/components/v2/*.tsx`

### Task 7.2: Remove tier References

Search and replace:
- Remove `tier` from all create/update calls
- Remove `tier` from type definitions
- Remove any tier-based filtering logic

### Task 7.3: Update Status References

- Remove `DRAFT` from status enums and types
- Update any `status: 'DRAFT'` to `status: 'ACTIVE'`

---

## Phase 8: Testing

### Task 8.1: Update/Add Tests

**Type guard tests:**
```typescript
describe('getSkillType', () => {
  it('returns intelligence for intelligence skills', () => {
    const block = { skillType: 'intelligence' };
    expect(getSkillType(block)).toBe('intelligence');
  });

  it('returns knowledge by default', () => {
    const block = { skillType: 'knowledge' };
    expect(getSkillType(block)).toBe('knowledge');
  });
});
```

**Composition tests:**
```typescript
describe('getSkillCreationComposition', () => {
  it('includes Q&A block for knowledge type', () => {
    const comp = getSkillCreationComposition('knowledge');
    expect(comp.blockIds).toContain('skill_common_questions_requirement');
    expect(comp.blockIds).toContain('knowledge_content_structure');
  });

  it('excludes Q&A block for intelligence type', () => {
    const comp = getSkillCreationComposition('intelligence');
    expect(comp.blockIds).not.toContain('skill_common_questions_requirement');
    expect(comp.blockIds).toContain('intelligence_content_structure');
  });
});
```

### Task 8.2: Manual Testing Checklist

- [ ] Create a knowledge-type skill - verify Q&A section generated
- [ ] Create an intelligence-type skill - verify NO Q&A section
- [ ] Create a foundational skill - verify auto-set to intelligence type
- [ ] Clone a foundational skill - verify starts as ACTIVE, not DRAFT
- [ ] Archive a skill - verify status changes to ARCHIVED
- [ ] Query skills by skillType - verify filtering works
- [ ] Verify all existing skills migrated correctly

---

## File Change Summary

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add skillType, drop isActive, drop tier, change status default |
| `prisma/migrations/*/migration.sql` | Migration script |
| `src/types/v2/building-block.ts` | Add SkillType, type guards, remove isActive/tier |
| `src/lib/v2/prompts/blocks/skill-output-blocks.ts` | Split into knowledge/intelligence blocks |
| `src/lib/v2/prompts/compositions/skill-compositions.ts` | Add skillType parameter to compositions |
| `src/lib/v2/skills/skill-generation-service.ts` | Accept skillType, use type-specific compositions |
| `src/lib/v2/skills/skill-orchestrator.ts` | Derive skillType from creationMode |
| `src/lib/v2/skills/modes/foundational-service.ts` | Use intelligence composition |
| `src/lib/v2/skills/template-service.ts` | Add skillType to cloned skills, change status to ACTIVE |
| `src/lib/v2/blocks/block-service.ts` | Remove isActive/tier, add skillType |
| `src/app/api/v2/skills/create/route.ts` | Validate and pass skillType |
| `src/app/api/v2/skills/generate/route.ts` | Accept skillType |
| `src/components/v2/CreateSkillModal.tsx` | Add skillType selector |
| Various hooks and components | Remove isActive/tier references |

---

## Execution Order

1. **Phase 1**: Database migration (run on dev first, verify, then staging/prod)
2. **Phase 2**: TypeScript types (will cause compile errors until Phase 3-6 done)
3. **Phase 3**: Prompt blocks and compositions
4. **Phase 4**: Service layer updates
5. **Phase 5**: API layer updates
6. **Phase 6**: UI changes
7. **Phase 7**: Code cleanup (remove dead isActive/tier references)
8. **Phase 8**: Testing

---

## Rollback Plan

If issues arise:

1. **Schema rollback** (if migration fails):
```sql
ALTER TABLE "BuildingBlock" ADD COLUMN "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "BuildingBlock" ADD COLUMN "tier" VARCHAR DEFAULT 'library';
ALTER TABLE "BuildingBlock" DROP COLUMN "skillType";
ALTER TABLE "BuildingBlock" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
```

2. **Code rollback**: Revert git commits in reverse order

---

## Notes for Implementation

- Run `npx prisma generate` after schema changes
- Run `npx prisma migrate dev` for local development
- Use `npx prisma migrate deploy` for production
- Coordinate migration timing with deployment to avoid downtime
