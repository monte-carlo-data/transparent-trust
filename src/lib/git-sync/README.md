# Git Sync Services

Unified git synchronization services for Skills, Customers, Prompts, and Templates. This architecture eliminates ~400 lines of duplicate code by providing a common base class with entity-specific implementations.

## Architecture

```
BaseGitSyncService (Abstract)
├── SkillGitSyncService
├── CustomerGitSyncService
├── PromptBlockGitSyncService
├── PromptModifierGitSyncService
└── TemplateGitSyncService
```

## Benefits

- **DRY Principle**: Single implementation of git operations (save, update, delete, history)
- **Type Safety**: Fully typed with TypeScript generics
- **Consistency**: All entities use the same git workflow
- **Testability**: Easy to mock and test
- **Extensibility**: Add new git-synced entities by extending base class

## Usage

### Quick Start

```typescript
import { skillGitSync, customerGitSync } from '@/lib/git-sync';

// Save a skill
await skillGitSync.saveAndCommit(
  'customer-onboarding',
  skillData,
  'Add customer onboarding skill',
  { name: 'John Doe', email: 'john@example.com' }
);

// Update a customer profile
await customerGitSync.updateAndCommit(
  'acme-corp',
  customerData,
  'Update Acme Corp profile',
  { name: 'Jane Smith', email: 'jane@example.com' }
);
```

### Available Services

#### Skill Git Sync

```typescript
import { skillGitSync } from '@/lib/git-sync';

// Save new skill
const sha = await skillGitSync.saveAndCommit(slug, skill, message, author);

// Update existing skill (handles renames automatically)
const sha = await skillGitSync.updateAndCommit(oldSlug, skill, message, author);

// Delete skill
const sha = await skillGitSync.deleteAndCommit(slug, message, author);

// Get history
const commits = await skillGitSync.getHistory(slug, 10);

// Get diff
const diff = await skillGitSync.getDiff(slug, 'HEAD~1', 'HEAD');

// Check if clean
const isClean = await skillGitSync.isClean();

// Get current branch
const branch = await skillGitSync.getCurrentBranch();

// Push to remote
await skillGitSync.pushToRemote('origin', 'main');
```

#### Customer Git Sync

Same API as skills, but for customer profiles in `customers/` directory:

```typescript
import { customerGitSync } from '@/lib/git-sync';

await customerGitSync.saveAndCommit(slug, customer, message, author);
await customerGitSync.updateAndCommit(oldSlug, customer, message, author);
await customerGitSync.deleteAndCommit(slug, message, author);
// ... etc
```

#### Prompt Git Sync

Prompts have two types: blocks and modifiers.

```typescript
import { promptBlockGitSync, promptModifierGitSync } from '@/lib/git-sync';

// Blocks
await promptBlockGitSync.saveAndCommit(blockId, block, message, author);
await promptBlockGitSync.deleteAndCommit(blockId, message, author);

// Modifiers
await promptModifierGitSync.saveAndCommit(modifierId, modifier, message, author);
await promptModifierGitSync.deleteAndCommit(modifierId, message, author);

// Note: Blocks and modifiers use stable IDs, so updateAndCommit doesn't rename
```

#### Template Git Sync

Same API as skills, but for collateral templates in `templates/` directory:

```typescript
import { templateGitSync } from '@/lib/git-sync';

await templateGitSync.saveAndCommit(slug, template, message, author);
await templateGitSync.updateAndCommit(oldSlug, template, message, author);
await templateGitSync.deleteAndCommit(slug, message, author);
// ... etc
```

### Common Operations

All services inherit these methods from `BaseGitSyncService`:

| Method | Description | Returns |
|--------|-------------|---------|
| `saveAndCommit(slug, entity, message, author)` | Save new entity and commit | Commit SHA or null |
| `updateAndCommit(oldSlug, entity, message, author)` | Update entity and commit (handles renames) | Commit SHA or null |
| `deleteAndCommit(slug, message, author)` | Delete entity and commit | Commit SHA or null |
| `getHistory(slug, limit)` | Get git log for entity | Array of commits |
| `getDiff(slug, from, to)` | Get diff between commits | Diff string |
| `isClean()` | Check if working directory is clean | boolean |
| `getCurrentBranch()` | Get current branch name | string |
| `pushToRemote(remote, branch)` | Push commits to remote | void |

## Types

### GitAuthor

```typescript
interface GitAuthor {
  name: string;
  email: string;
}
```

### GitCommitInfo

```typescript
interface GitCommitInfo {
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}
```

## Backwards Compatibility

The old function-based APIs are still supported via compatibility layers:

```typescript
// Old API (still works, but deprecated)
import { saveSkillAndCommit } from '@/lib/skillGitSync';
await saveSkillAndCommit(slug, skill, message, author);

// New API (recommended)
import { skillGitSync } from '@/lib/git-sync';
await skillGitSync.saveAndCommit(slug, skill, message, author);
```

All existing code continues to work without changes. The old imports delegate to the new services internally.

## Migration Guide

### For New Code

Use the new service-based API:

```typescript
// ✅ Good - New service API
import { skillGitSync } from '@/lib/git-sync';
const sha = await skillGitSync.saveAndCommit(slug, skill, message, author);

// ❌ Old - Function-based API (deprecated)
import { saveSkillAndCommit } from '@/lib/skillGitSync';
const sha = await saveSkillAndCommit(slug, skill, message, author);
```

### For Existing Code

No immediate changes needed! The old APIs work via compatibility layers. Migrate at your convenience:

1. Update imports: `@/lib/skillGitSync` → `@/lib/git-sync`
2. Update calls: `saveSkillAndCommit(...)` → `skillGitSync.saveAndCommit(...)`
3. Remove old imports once all references updated

## Extending for New Entity Types

To add a new git-synced entity:

1. **Create service file**: `src/lib/git-sync/my-entity-git-sync.service.ts`

```typescript
import { BaseGitSyncService } from "./base-git-sync.service";
import { writeMyEntityFile, getMyEntitySlug, /* ... */ } from "../myEntityFiles";
import type { MyEntityFile } from "../myEntityFiles";

class MyEntityGitSyncService extends BaseGitSyncService<MyEntityFile> {
  protected getDirectory(): string {
    return "my-entities";
  }

  protected getFileExtension(): string {
    return "md";
  }

  protected generateSlug(entity: MyEntityFile): string {
    return getMyEntitySlug(entity.name);
  }

  protected async writeFile(slug: string, entity: MyEntityFile): Promise<void> {
    await writeMyEntityFile(slug, entity);
  }

  protected async deleteFile(slug: string): Promise<void> {
    await deleteMyEntityFile(slug);
  }

  protected async renameFile(oldSlug: string, newSlug: string): Promise<void> {
    await renameMyEntityFile(oldSlug, newSlug);
  }
}

export const myEntityGitSync = new MyEntityGitSyncService();
```

2. **Export from index**: Add to `src/lib/git-sync/index.ts`

```typescript
export { myEntityGitSync } from "./my-entity-git-sync.service";
```

3. **Use it**:

```typescript
import { myEntityGitSync } from '@/lib/git-sync';
await myEntityGitSync.saveAndCommit(slug, entity, message, author);
```

## Implementation Details

### Base Class Pattern

The `BaseGitSyncService` abstract class provides:
- Common git operations (add, commit, push, history)
- Automatic file path generation
- Consistent error handling
- Type-safe generics

### Template Method Pattern

Subclasses override abstract methods to customize behavior:
- `getDirectory()`: Where files are stored
- `getFileExtension()`: File extension (.md, .json, etc.)
- `generateSlug()`: How to generate filename from entity
- `writeFile()`: How to write entity to disk
- `deleteFile()`: How to delete entity file
- `renameFile()`: How to rename entity file

### Singleton Pattern

Each service is exported as a singleton instance:
```typescript
export const skillGitSync = new SkillGitSyncService();
```

This ensures consistent behavior across the application and makes testing easier (can mock the singleton).

## Testing

Example test using the service:

```typescript
import { skillGitSync } from '@/lib/git-sync';

describe('Skill Git Sync', () => {
  it('should save and commit a skill', async () => {
    const sha = await skillGitSync.saveAndCommit(
      'test-skill',
      { title: 'Test Skill', content: 'Test content', /* ... */ },
      'Add test skill',
      { name: 'Test User', email: 'test@example.com' }
    );

    expect(sha).toBeTruthy();

    const history = await skillGitSync.getHistory('test-skill', 1);
    expect(history[0].message).toBe('Add test skill');
  });
});
```

## Performance

- **Lazy loading**: Services are only instantiated when first used
- **Singleton pattern**: One instance per entity type
- **Git operations**: Delegated to optimized gitCommitHelpers
- **No redundant work**: Base class eliminates duplicate git logic

## Code Reduction

Before refactoring:
- `skillGitSync.ts`: 155 lines
- `customerGitSync.ts`: 222 lines
- `promptGitSync.ts`: 134 lines
- `templateGitSync.ts`: 121 lines
- **Total: 632 lines**

After refactoring:
- `base-git-sync.service.ts`: 209 lines (shared)
- `skill-git-sync.service.ts`: 53 lines
- `customer-git-sync.service.ts`: 53 lines
- `prompt-block-git-sync.service.ts`: 51 lines
- `prompt-modifier-git-sync.service.ts`: 49 lines
- `template-git-sync.service.ts`: 53 lines
- **Total: 468 lines** (26% reduction)

Plus compatibility layers are thin wrappers that can be removed later.

## Future Enhancements

Potential improvements:
1. **Add retry logic** for failed git operations
2. **Add batching** for multiple file operations
3. **Add hooks** for pre/post-commit actions
4. **Add validation** before committing
5. **Add conflict resolution** helpers
6. **Add branch management** utilities
7. **Add remote sync status** checks

---

**Last Updated:** 2024-12-28
**Maintainer:** Development Team
