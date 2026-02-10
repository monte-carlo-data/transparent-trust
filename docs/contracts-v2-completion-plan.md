# Contracts V2 Completion Plan

## Current State Analysis

### Problem: Three Incomplete Implementations

#### 1. V1 UI (`/src/app/contracts/[id]/page.tsx`) ❌
- **Status**: Outdated, non-functional
- **Issues**:
  - Uses legacy data model
  - No connection to V2 prompts
  - No processing backend
- **Action**: DELETE entirely

#### 2. V2 UI (`/src/app/v2/contracts/[id]/page.tsx`) ⚠️
- **Status**: Partially complete
- **Has**:
  - Contract detail page with tabbed UI
  - Display of contract metadata
  - Placeholder rows created on upload
- **Missing**:
  - Processing trigger button
  - Status polling during processing
  - Error handling UI
  - Regeneration capabilities
- **Action**: Complete implementation

#### 3. V2 Prompts (`/src/lib/v2/prompts/compositions/contract-analysis-compositions.ts`) ⚠️
- **Status**: Defined but unused
- **Has**:
  - `contract_analysis` composition with proper blocks
  - System prompt structure
- **Missing**:
  - Integration with processing pipeline
- **Action**: Connect to processing logic

### What Works Today

✅ **Upload Flow** (`/api/v2/contracts/upload/route.ts`):
- Accepts PDF/DOCX/TXT files
- Extracts text from documents
- Creates `BulkProject` with `projectType='contract-review'`
- Creates 5 placeholder `BulkRow` entries:
  1. Summary
  2. Risk Analysis
  3. Obligations Extraction
  4. Key Terms
  5. Recommendations

✅ **Data Model** (uses existing `BulkProject` + `BulkRow`):
- Reuses RFP batch processing infrastructure
- Status tracking (`PENDING`, `PROCESSING`, `COMPLETED`, `ERROR`)
- Transparency metadata storage

❌ **What's Missing**:
- Processing endpoint to analyze contracts
- UI to trigger processing
- Status polling during analysis
- Display of analysis results
- Error recovery

## Architecture: Contracts as Specialized Batch Processing

Contracts follow the **same pattern as RFPs** but with:
- Fixed analysis types (no skill selection needed)
- Single batch processing (all 5 analyses at once)
- Document content as context instead of file upload

### Reusable Infrastructure

From RFP implementation:
- ✅ `BulkProject` + `BulkRow` data model
- ✅ Status polling pattern
- ✅ Batch processor architecture (`/src/lib/v2/rfp/batch-processor.ts`)
- ✅ Progress tracking with DB updates

### Contract-Specific Logic

New/Modified:
- Contract upload creates fixed 5 rows (already done)
- Processing uses `contract_analysis` composition
- No skill selection UI (analyses are fixed)
- Simpler processing trigger (single "Analyze Contract" button)

## Implementation Plan

### Phase 1: Backend Processing (Priority: High)

#### Task 1.1: Create Contract Batch Processor
**File**: `/src/lib/v2/contracts/contract-processor.ts`

```typescript
import { prisma } from '@/lib/prisma';
import { executeLLMCall } from '@/lib/llm/registry';
import { logger } from '@/lib/logger';
import { generateErrorId } from '@/lib/error-id';

export interface ContractProcessorParams {
  projectId: string;
  modelSpeed: 'fast' | 'quality';
}

export interface ContractProcessorResult {
  projectId: string;
  totalAnalyses: number;
  completedAnalyses: number;
  errorCount: number;
  analyses: Array<{
    type: string;
    status: 'COMPLETED' | 'ERROR';
    error?: string;
  }>;
}

export async function processContract(
  params: ContractProcessorParams
): Promise<ContractProcessorResult> {
  const { projectId, modelSpeed } = params;

  // Fetch project with contract text
  const project = await prisma.bulkProject.findUnique({
    where: { id: projectId },
    include: { rows: { orderBy: { rowNumber: 'asc' } } },
  });

  if (!project || project.projectType !== 'contract-review') {
    throw new Error('Invalid contract project');
  }

  // Extract contract text from config
  const contractText = project.fileContext || '';
  if (!contractText) {
    throw new Error('No contract text found');
  }

  // Update project to PROCESSING
  await prisma.bulkProject.update({
    where: { id: projectId },
    data: { status: 'PROCESSING' },
  });

  let completedAnalyses = 0;
  let errorCount = 0;
  const analyses: ContractProcessorResult['analyses'] = [];

  // Process each analysis type
  for (const row of project.rows) {
    const analysisType = (row.inputData as any).type;
    const analysisLabel = (row.inputData as any).label;

    logger.info('Processing contract analysis', {
      projectId,
      rowId: row.id,
      analysisType,
    });

    try {
      // Build analysis prompt
      const analysisPrompt = buildAnalysisPrompt(analysisType, contractText);

      // Execute via registry
      const result = await executeLLMCall({
        question: analysisPrompt,
        compositionId: 'contract_analysis',
        runtimeContext: {
          analysisType,
        },
        skills: [], // No skills needed for contract analysis
        modelSpeed,
      });

      // Save result
      await prisma.bulkRow.update({
        where: { id: row.id },
        data: {
          outputData: {
            analysis: result.answer,
            transparency: {
              compositionId: result.transparency.compositionId,
              systemPrompt: result.transparency.systemPrompt,
              model: result.usage?.model || 'unknown',
            },
          },
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      completedAnalyses++;
      analyses.push({ type: analysisType, status: 'COMPLETED' });

      logger.info('Contract analysis completed', {
        projectId,
        rowId: row.id,
        analysisType,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorId = generateErrorId();

      logger.error('Contract analysis failed', error, {
        projectId,
        rowId: row.id,
        analysisType,
        errorId,
      });

      await prisma.bulkRow.update({
        where: { id: row.id },
        data: {
          status: 'ERROR',
          processedAt: new Date(),
          outputData: {
            error: errorMessage,
            errorId,
          },
        },
      });

      errorCount++;
      analyses.push({ type: analysisType, status: 'ERROR', error: errorMessage });
    }
  }

  // Update project to final status
  await prisma.bulkProject.update({
    where: { id: projectId },
    data: {
      status: errorCount > 0 ? 'ERROR' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  logger.info('Contract processing complete', {
    projectId,
    totalAnalyses: project.rows.length,
    completedAnalyses,
    errorCount,
  });

  return {
    projectId,
    totalAnalyses: project.rows.length,
    completedAnalyses,
    errorCount,
    analyses,
  };
}

function buildAnalysisPrompt(analysisType: string, contractText: string): string {
  const prompts: Record<string, string> = {
    summary: `Analyze this contract and provide a comprehensive summary. Include:
- Parties involved
- Contract type and purpose
- Key dates (effective date, term, renewal, termination)
- Primary obligations and deliverables
- Financial terms (if applicable)

Contract:
${contractText}`,

    risks: `Analyze this contract for potential risks and issues. Identify:
- Legal risks (ambiguous terms, missing clauses, unfavorable conditions)
- Financial risks (payment terms, liability limits, penalties)
- Operational risks (delivery requirements, performance obligations)
- Compliance risks (regulatory requirements, data privacy)

For each risk, provide:
- Risk category
- Severity (High/Medium/Low)
- Description
- Recommendation

Contract:
${contractText}`,

    obligations: `Extract all obligations from this contract. For each party, list:
- What they must do (affirmative obligations)
- What they must not do (negative obligations)
- Deadlines and timeframes
- Performance standards
- Consequences of non-compliance

Contract:
${contractText}`,

    'key-terms': `Extract and explain the key terms from this contract:
- Defined terms and their meanings
- Important clauses (termination, liability, indemnification, warranties)
- Financial terms (payment, pricing, invoicing)
- Intellectual property provisions
- Confidentiality requirements
- Dispute resolution mechanism

Contract:
${contractText}`,

    recommendations: `Provide actionable recommendations for this contract:
- Favorable terms to highlight
- Unfavorable terms to renegotiate
- Missing clauses to add
- Ambiguous language to clarify
- Compliance requirements to track
- Next steps for execution

Contract:
${contractText}`,
  };

  return prompts[analysisType] || `Analyze this contract:\n\n${contractText}`;
}
```

#### Task 1.2: Create Processing Endpoint
**File**: `/src/app/api/v2/contracts/[id]/process/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { processContract } from '@/lib/v2/contracts/contract-processor';
import { logger } from '@/lib/logger';

export const maxDuration = 300; // 5 minutes for contract analysis

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    const body = await request.json();
    const modelSpeed = body.modelSpeed || 'quality';

    logger.info('Starting contract processing', {
      projectId,
      userId: session.user.id,
      modelSpeed,
    });

    const result = await processContract({
      projectId,
      modelSpeed,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Contract processing failed', error, {
      projectId,
      userId: session.user.id,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}
```

#### Task 1.3: Create Status Polling Endpoint
**File**: `/src/app/api/v2/contracts/[id]/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v2';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    const project = await prisma.bulkProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            rows: {
              where: {
                OR: [
                  { status: 'PENDING' },
                  { status: 'COMPLETED' },
                  { status: 'ERROR' },
                ],
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rowCounts = await prisma.bulkRow.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const counts = {
      pending: 0,
      completed: 0,
      error: 0,
    };

    rowCounts.forEach((row) => {
      if (row.status === 'PENDING') counts.pending = row._count;
      if (row.status === 'COMPLETED') counts.completed = row._count;
      if (row.status === 'ERROR') counts.error = row._count;
    });

    return NextResponse.json({
      projectId: project.id,
      projectStatus: project.status,
      analyses: counts,
      isProcessing: project.status === 'PROCESSING',
    });
  } catch (error) {
    console.error('Status check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
```

### Phase 2: UI Implementation (Priority: High)

#### Task 2.1: Add Processing Controls to Contract Detail Page
**File**: `/src/app/v2/contracts/[id]/page.tsx` (modifications)

Add to existing page:

```typescript
// Add state for processing
const [isProcessing, setIsProcessing] = useState(false);
const [processingStatus, setProcessingStatus] = useState({
  pending: 0,
  completed: 0,
  error: 0,
});

// Add processing handler
const handleAnalyzeContract = async () => {
  if (!contract) return;

  setIsProcessing(true);

  try {
    const response = await fetch(`/api/v2/contracts/${contract.id}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelSpeed: 'quality' }),
    });

    if (!response.ok) {
      throw new Error('Processing failed');
    }

    toast.success('Contract analysis started');
  } catch (error) {
    console.error('Failed to start processing:', error);
    toast.error('Failed to start contract analysis');
    setIsProcessing(false);
  }
};

// Add status polling
useEffect(() => {
  if (!isProcessing || !contract) return;

  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/v2/contracts/${contract.id}/status`);
      if (!response.ok) return;

      const data = await response.json();
      setProcessingStatus(data.analyses);

      if (!data.isProcessing) {
        setIsProcessing(false);
        clearInterval(pollInterval);
        // Refresh contract data
        router.refresh();
        toast.success('Contract analysis complete');
      }
    } catch (error) {
      console.error('Status poll failed:', error);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(pollInterval);
}, [isProcessing, contract, router]);

// Add Analyze button in UI (before tabs)
{contract.status === 'IN_PROGRESS' && !isProcessing && (
  <div className="mb-6">
    <Button
      onClick={handleAnalyzeContract}
      disabled={isProcessing}
      size="lg"
      className="w-full"
    >
      <FileText className="h-4 w-4 mr-2" />
      Analyze Contract
    </Button>
  </div>
)}

{isProcessing && (
  <div className="mb-6 p-4 bg-muted rounded-lg">
    <div className="flex items-center justify-between mb-2">
      <span className="font-medium">Analyzing contract...</span>
      <InlineLoader size="sm" />
    </div>
    <div className="text-sm text-muted-foreground">
      {processingStatus.completed} of 5 analyses complete
    </div>
  </div>
)}
```

#### Task 2.2: Improve Analysis Display
**File**: `/src/app/v2/contracts/[id]/page.tsx` (modifications)

Enhance tab content rendering:

```typescript
// For each tab, show loading/error/content states
const renderAnalysisTab = (row: BulkRow | undefined, type: string) => {
  if (!row) {
    return (
      <div className="text-muted-foreground">
        Analysis type not found
      </div>
    );
  }

  if (row.status === 'PENDING') {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mb-4 opacity-50" />
        <p>This analysis will be available after processing</p>
      </div>
    );
  }

  if (row.status === 'ERROR') {
    const errorData = row.outputData as any;
    return (
      <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
        <p className="font-medium text-destructive mb-2">Analysis Failed</p>
        <p className="text-sm text-muted-foreground">{errorData?.error || 'Unknown error'}</p>
        {errorData?.errorId && (
          <p className="text-xs text-muted-foreground mt-2">Error ID: {errorData.errorId}</p>
        )}
      </div>
    );
  }

  const output = row.outputData as any;
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown>{output?.analysis || 'No analysis available'}</ReactMarkdown>
    </div>
  );
};
```

### Phase 3: V1 Cleanup (Priority: Medium)

#### Task 3.1: Delete V1 Contracts Implementation
**Files to delete**:
- `/src/app/contracts/[id]/page.tsx`
- `/src/app/contracts/page.tsx`
- `/src/app/contracts/new/page.tsx`
- Any V1-specific components in `/src/components/contracts/`

#### Task 3.2: Update Navigation
**File**: Navigation components
- Remove V1 contracts links
- Ensure V2 contracts route is primary

### Phase 4: Testing & Polish (Priority: Medium)

#### Task 4.1: End-to-End Testing
Test complete workflow:
1. Upload contract (PDF/DOCX/TXT)
2. Verify 5 rows created with PENDING status
3. Click "Analyze Contract"
4. Verify processing starts (status updates)
5. Verify polling works (every 5 seconds)
6. Verify all 5 analyses complete
7. Verify results display correctly in tabs
8. Test error handling (invalid file, processing failure)

#### Task 4.2: Error Recovery
Add features:
- Retry button for failed analyses
- Regenerate button for completed analyses
- Clear/reset contract

#### Task 4.3: Performance Optimization
- Add Redis-based background processing (like RFPs)
- Parallelize analyses (run all 5 simultaneously)
- Add rate limiting to prevent abuse

### Phase 5: Future Enhancements (Priority: Low)

#### Conversational Interface (uses ConversationalLayout)
After completing basic processing, add conversational mode:
- Left sidebar: Contract sections/clauses navigation
- Center: Chat interface for Q&A about contract
- Right sidebar: Referenced sections highlighted
- Uses `contract_analysis` composition
- Maintains context of entire contract

#### Advanced Features
- Contract comparison (diff two versions)
- Custom analysis types (user-defined)
- Export to Word with tracked changes
- Integration with DocuSign/e-signature platforms

## Success Metrics

- [ ] Contract upload creates 5 analysis rows
- [ ] "Analyze Contract" button triggers processing
- [ ] Status polling updates UI every 5 seconds
- [ ] All 5 analyses complete successfully
- [ ] Results display in tabbed interface
- [ ] Error states handled gracefully
- [ ] V1 contracts implementation deleted
- [ ] End-to-end workflow <2 minutes for typical contract
- [ ] Test coverage >70% for new code

## Timeline Estimate

- **Phase 1** (Backend): 4-6 hours
- **Phase 2** (UI): 3-4 hours
- **Phase 3** (Cleanup): 1-2 hours
- **Phase 4** (Testing): 2-3 hours
- **Total**: 10-15 hours

## Dependencies

- ✅ Existing `BulkProject` + `BulkRow` infrastructure
- ✅ LLM registry with `contract_analysis` composition
- ✅ Batch processing patterns from RFP feature
- ✅ Status polling patterns from RFP feature
- ⚠️ Contract upload route (functional but may need text extraction improvements)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Contract text extraction fails for some PDFs | Medium | Add fallback to Claude's PDF reading, add better error messages |
| Processing timeout (>5 min) | High | Add Redis background processing, split into jobs |
| Poor analysis quality | Medium | Refine `contract_analysis` prompts, add examples |
| Large contracts (>100 pages) | Medium | Add text chunking, summarization preprocessing |

## Open Questions

1. Should we support re-analysis of individual sections?
   - **Recommendation**: Yes, add "Regenerate" button per tab

2. How to handle contracts with multiple files?
   - **Recommendation**: Phase 2 enhancement, allow multiple uploads per project

3. Should we add custom analysis types?
   - **Recommendation**: Phase 5 enhancement, focus on fixed 5 for now

4. How to integrate with ConversationalLayout?
   - **Recommendation**: After Phase 4, create conversational contract review mode
