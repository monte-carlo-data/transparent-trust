# V2 Skill Generation Service

The skill generation service orchestrates LLM-based skill creation, updates, and matching using the v2 prompt system.

## Features

- **Scope-Based Design**: Skills include explicit scope definitions (what they cover, future additions, boundaries)
- **Source Citations**: All content is traceable back to sources with inline [1], [2] citations
- **Contradiction Detection**: Identifies conflicts between sources and recommends resolutions
- **Library-Specific**: Tailored instructions for IT, GTM, Knowledge, and customer skills
- **Change Tracking**: Updates show exactly what changed for easy review
- **Smart Matching**: Match sources to existing skills based on scope definitions

## Usage

### Create a New Skill

```typescript
import { generateSkill } from '@/lib/v2/skills';

const skill = await generateSkill({
  sources: [
    {
      id: 'url-123',
      type: 'url',
      label: 'https://docs.example.com/ai',
      content: '# AI Features\nWe support GPT-4 and Claude 3...',
    },
  ],
  libraryId: 'knowledge',
  // Optional: for IT or GTM specific context
  // libraryId: 'it' | 'gtm'
  // Optional: for customer-specific skills
  // isCustomerSkill: true,
  // customerName: 'Acme Corp',
});

// Result includes:
// - title, content, summary
// - scopeDefinition (covers, futureAdditions, notIncluded)
// - citations [1], [2], etc. linked to sources
// - contradictions if sources conflict
// - attributes (keywords, product, etc.)
```

### Update an Existing Skill

```typescript
import { updateSkill } from '@/lib/v2/skills';

const updated = await updateSkill({
  existingSkill: {
    title: 'AI Features and Tech Specs',
    content: 'Previous skill content here...',
    scopeDefinition: {
      covers: 'AI platform features and specifications',
      futureAdditions: [
        'New model releases',
        'Updated rate limits',
        'API changes',
      ],
      notIncluded: [
        'Usage tutorials',
        'Pricing',
        'Customer case studies',
      ],
    },
    citations: [
      { id: '1', sourceId: 'url-123', label: 'https://docs.example.com/ai' },
    ],
  },
  newSources: [
    {
      id: 'url-456',
      type: 'url',
      label: 'https://docs.example.com/ai-v2',
      content: 'Updated AI documentation...',
    },
  ],
  libraryId: 'knowledge',
});

// Result includes:
// - Updated title, content, summary
// - changes: { sectionsAdded, sectionsUpdated, sectionsRemoved, changeSummary }
// - New contradictions if sources conflict
// - splitRecommendation if skill becomes too broad
```

### Match a Source to Existing Skills

```typescript
import { matchSourceToSkills } from '@/lib/v2/skills';

const matches = await matchSourceToSkills({
  source: {
    id: 'gong-789',
    type: 'gong',
    label: 'Gong call with Acme Corp',
    content: 'Call transcript discussing security concerns and integration options...',
  },
  existingSkills: [
    {
      id: 'skill-111',
      title: 'Security & Compliance',
      scopeDefinition: {
        covers: 'Security controls and compliance certifications',
        futureAdditions: [
          'New certifications',
          'Updated security policies',
          'Compliance with new regulations',
        ],
      },
    },
    {
      id: 'skill-222',
      title: 'Integrations & APIs',
      scopeDefinition: {
        covers: 'API reference and integration patterns',
        futureAdditions: [
          'New API endpoints',
          'Integration examples',
          'Webhook support',
        ],
      },
    },
  ],
  libraryId: 'gtm',
});

// Result includes:
// - matches: Array of matching skills with confidence, reason, excerpt
// - createNew: Recommendation to create new skill if no matches
```

## Library-Specific Context

Each library gets tailored instructions:

### Knowledge
- Focus on product capabilities, features, technical details
- Include version numbers and release information
- Document integrations and API details

### IT
- Include application/system names explicitly
- Capture error codes, symptoms, diagnostic steps
- Document resolution steps in clear, actionable sequence
- Reference Zendesk ticket patterns

### GTM
- Note industry vertical relevance
- Capture deal stage applicability
- Document competitor mentions and positioning
- Include objection handling patterns

## Output Formats

All three functions return JSON with proper structure:

### SkillCreationOutput
```json
{
  "title": "AI Features and Tech Specs",
  "content": "Comprehensive content with [1], [2] citations...",
  "summary": "One sentence summary",
  "scopeDefinition": {
    "covers": "What this covers",
    "futureAdditions": ["What to add next"],
    "notIncluded": ["What not to include"]
  },
  "citations": [
    { "id": "1", "sourceId": "...", "label": "...", "url": "..." }
  ],
  "contradictions": [
    {
      "type": "version_mismatch",
      "description": "...",
      "sourceA": {...},
      "sourceB": {...},
      "severity": "high",
      "recommendation": "..."
    }
  ],
  "attributes": {
    "keywords": ["..."],
    "product": "..."
  }
}
```

### SkillUpdateOutput
Similar to creation, but includes:
- `changes`: { sectionsAdded, sectionsUpdated, sectionsRemoved, changeSummary }
- `splitRecommendation`: If skill should be split into multiple skills

### SkillMatchingOutput
```json
{
  "matches": [
    {
      "skillId": "...",
      "skillTitle": "...",
      "confidence": "high|medium|low",
      "reason": "Why it matches",
      "matchedCriteria": "Which scope criteria matched",
      "suggestedExcerpt": "What to use from source"
    }
  ],
  "createNew": {
    "recommended": false,
    "suggestedTitle": "...",
    "suggestedScope": {...}
  }
}
```

## Integration with API

Use this service in API endpoints:

```typescript
import { generateSkill } from '@/lib/v2/skills';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { sourceIds, libraryId, customerId } = await request.json();

  // Fetch sources from database
  const sources = await prisma.stagedSource.findMany({
    where: { id: { in: sourceIds } },
  });

  // Generate skill using v2 service
  const skillOutput = await generateSkill({
    sources: sources.map(s => ({
      id: s.id,
      type: s.sourceType,
      label: s.title,
      content: s.content || '',
    })),
    libraryId,
    isCustomerSkill: !!customerId,
  });

  // Store the result...
}
```

## Error Handling

All functions throw errors with descriptive messages:

```typescript
try {
  const skill = await generateSkill({...});
} catch (error) {
  console.error('Failed to generate skill:', error.message);
  // Handle error: "Failed to generate skill: Claude returned an empty response"
}
```

## Notes

- Sources are formatted with citation numbers [1], [2], etc.
- Claude parses JSON with proper schema validation
- Markdown code blocks in responses are automatically cleaned
- Uses circuit breaker for API reliability
- Respects LLM token limits and temperature settings
