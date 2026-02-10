# ConversationalLayout Component Design

## Overview

The `ConversationalLayout` component extracts the shared three-panel conversational interface pattern from Chat and Collateral pages, eliminating ~550 LOC of duplication.

## Problem Analysis

### Current Duplication (82% overlap between pages)

**Duplicated UI Structure (~400 LOC)**:
- Three-panel layout (left sidebar | messages | right sidebar)
- Resizable panels with collapse/expand
- Message rendering with user/bot avatars
- Input area with textarea and send button
- Status bar showing context counts
- Transparency modal integration
- Top control bar integration

**Duplicated State Management (~100 LOC)**:
- Sidebar collapse states
- Resizable panel hooks
- Message transparency modal state
- Settings store integration (modelSpeed, callMode, webSearch)
- Selection store integration (skills, docs, URLs)
- Customer loading and selection

**Duplicated Behavior (~50 LOC)**:
- Send message handling with session creation
- Preset/persona change handling
- Customer selection with session locking
- Input keyboard shortcuts (Enter to send)
- Transparency viewing

### Page-Specific Features

**Chat Page**:
- Left sidebar: Session history list
- Empty state: "Start a conversation"
- Session management: load/delete/create operations
- Prompt preview modal

**Collateral Page**:
- Left sidebar: Template selection grid
- Empty state: "Create Collateral" with instructions
- Generate from template button
- Export buttons: Copy, Download, Slides

## Component Architecture

### Core Component: `ConversationalLayout`

```typescript
interface ConversationalLayoutProps {
  // Sidebar Configuration
  leftSidebar: {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    content: React.ReactNode;
    footer?: React.ReactNode;
    storageKey: string; // For resizable panel persistence
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    defaultOpen?: boolean;
  };

  rightSidebar: {
    title: string;
    icon?: React.ComponentType<{ className?: string }>;
    content: React.ReactNode;
    storageKey: string;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    defaultOpen?: boolean;
  };

  // Top Control Bar
  controlBar: {
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
    // Pass through ContextControlsBar props
    selectedPresetId: string | null;
    onPresetChange: (preset: InstructionPreset | null) => void;
    onUserInstructionsChange: (instructions: string) => void;
    callMode?: boolean;
    onCallModeChange?: (enabled: boolean) => void;
    customers: Customer[];
    selectedCustomerId: string | null;
    onCustomerSelect: (customerId: string | null) => void;
    customersLoading?: boolean;
    customerDisabled?: boolean;
    customerDisabledReason?: string;
    skills?: Array<{ id: string; categories: string[] }>;
    onSkillsAutoSelected?: (selectedCount: number, categories: string[]) => void;
  };

  // Messages
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    transparency?: any;
    feedback?: any;
  }>;

  // Message Handlers
  onSendMessage: (message: string) => Promise<void>;
  isSendingMessage: boolean;

  // Empty State
  emptyState: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description: string | React.ReactNode;
  };

  // Status Bar
  statusBar: {
    selectedSkillCount: number;
    selectedDocCount: number;
    selectedUrlCount: number;
    modelSpeed: 'fast' | 'quality';
    isLoading: boolean;
    onCustomize: () => void;
    onPreviewPrompt?: () => void;
    selectedCustomerName: string | null;
  };

  // Input Area
  input: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  };

  // Settings
  settings: {
    modelSpeed: 'fast' | 'quality';
    setModelSpeed: (speed: 'fast' | 'quality') => void;
    webSearchEnabled: boolean;
    setWebSearchEnabled: (enabled: boolean) => void;
  };

  // Optional Features
  showPromptPreview?: boolean;
  onPromptPreviewClose?: () => void;
  promptPreviewContent?: React.ReactNode;
}
```

### Supporting Components

#### 1. `ConversationalSidebar`
Handles sidebar logic (collapse, resize, edge toggle):

```typescript
interface ConversationalSidebarProps {
  side: 'left' | 'right';
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}
```

#### 2. `MessageBubble`
Renders individual messages with user/bot avatars:

```typescript
interface MessageBubbleProps {
  message: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    transparency?: any;
    feedback?: any;
  };
  sessionId: string | null;
  onViewTransparency: (messageId: string) => void;
  onFeedbackChange: () => void;
}
```

#### 3. `MessageInputArea`
Input controls with speed/search toggles:

```typescript
interface MessageInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
  modelSpeed: 'fast' | 'quality';
  onModelSpeedChange: (speed: 'fast' | 'quality') => void;
  webSearchEnabled: boolean;
  onWebSearchChange: (enabled: boolean) => void;
}
```

## File Structure

```
src/components/v2/conversational-layout/
├── ConversationalLayout.tsx          # Main layout component
├── ConversationalSidebar.tsx         # Reusable sidebar with collapse/resize
├── MessageBubble.tsx                 # Individual message rendering
├── MessageInputArea.tsx              # Input area with controls
├── types.ts                          # Shared TypeScript interfaces
└── index.ts                          # Public exports
```

## Migration Strategy

### Phase 1: Component Creation
1. Create `ConversationalLayout` component structure
2. Extract sidebar logic into `ConversationalSidebar`
3. Extract message rendering into `MessageBubble`
4. Extract input area into `MessageInputArea`
5. Add comprehensive TypeScript types

### Phase 2: Chat Page Migration
1. Replace chat page layout with `ConversationalLayout`
2. Pass session history as `leftSidebar.content`
3. Pass KnowledgeBar as `rightSidebar.content`
4. Remove ~400 LOC of duplicated code
5. Test all chat features (history, sessions, transparency)

### Phase 3: Collateral Page Migration
1. Replace collateral page layout with `ConversationalLayout`
2. Pass template selector as `leftSidebar.content`
3. Pass KnowledgeBar as `rightSidebar.content`
4. Pass export buttons as `controlBar.rightContent`
5. Remove ~400 LOC of duplicated code
6. Test all collateral features (templates, generation, export)

### Phase 4: Polish & Documentation
1. Add unit tests for new components
2. Document usage patterns
3. Identify other features that could benefit (Contracts V2)

## Usage Examples

### Chat Page Example

```typescript
<ConversationalLayout
  leftSidebar={{
    title: "Chat History",
    icon: MessageSquare,
    content: <ChatHistoryList sessions={sessions} onLoad={loadSession} onDelete={deleteSession} />,
    footer: <NewChatButton onClick={startNewChat} />,
    storageKey: "chat-v2-history-width",
    defaultWidth: 320,
    minWidth: 280,
    maxWidth: 400,
    defaultOpen: false,
  }}
  rightSidebar={{
    title: "Knowledge Context",
    content: <KnowledgeBar selectedPersona={selectedPersona} selectedCustomerId={selectedCustomerId} />,
    storageKey: "chat-v2-knowledge-width",
    defaultWidth: 360,
    minWidth: 280,
    maxWidth: 500,
    defaultOpen: false,
  }}
  controlBar={{
    leftContent: <ChatHistoryToggle count={sessions.length} />,
    // ... other control bar props
  }}
  messages={messages}
  onSendMessage={handleSendMessage}
  isSendingMessage={isSendingMessage}
  emptyState={{
    icon: Bot,
    title: "Start a conversation",
    description: "Select knowledge sources from the sidebar, then ask a question",
  }}
  // ... other props
/>
```

### Collateral Page Example

```typescript
<ConversationalLayout
  leftSidebar={{
    title: "Templates",
    icon: FileText,
    content: <TemplateSelector templates={templates} selected={selectedTemplateId} onSelect={setSelectedTemplateId} />,
    footer: <GenerateButton template={selectedTemplate} onClick={handleGenerate} disabled={isSendingMessage} />,
    storageKey: "collateral-v2-template-width",
    defaultWidth: 340,
    minWidth: 280,
    maxWidth: 450,
    defaultOpen: true,
  }}
  rightSidebar={{
    title: "Knowledge Context",
    content: <KnowledgeBar selectedPersona={selectedPersona} selectedCustomerId={selectedCustomerId} />,
    storageKey: "collateral-v2-knowledge-width",
    defaultWidth: 360,
    minWidth: 280,
    maxWidth: 500,
    defaultOpen: true,
  }}
  controlBar={{
    rightContent: <ExportButtons latestMessage={latestAssistantMessage} />,
    // ... other control bar props
  }}
  messages={messages}
  onSendMessage={handleSendMessage}
  isSendingMessage={isSendingMessage}
  emptyState={{
    icon: FileText,
    title: "Create Collateral",
    description: (
      <>
        1. Select a template from the sidebar<br />
        2. Choose customer context and knowledge sources<br />
        3. Click "Generate Collateral" to create content<br />
        4. Refine with follow-up messages
      </>
    ),
  }}
  // ... other props
/>
```

## Benefits

1. **Eliminates Duplication**: Removes ~550 LOC of duplicated code between Chat and Collateral
2. **Consistency**: Ensures identical behavior across conversational features
3. **Maintainability**: Single source of truth for layout changes
4. **Extensibility**: Easy to add new conversational features (Contracts V2)
5. **Testability**: Centralized components can be thoroughly tested
6. **Performance**: Shared logic reduces bundle size
7. **Developer Experience**: Clear patterns for building conversational interfaces

## Future Features Using ConversationalLayout

1. **Contracts V2**: Three-panel contract analysis interface
2. **Interactive Docs**: Document Q&A with source preview
3. **Training Mode**: Interactive knowledge testing
4. **Customer Views**: Conversational customer intelligence

## Open Questions

1. Should transparency modal be part of ConversationalLayout or remain external?
   - **Recommendation**: Keep external but provide standardized integration props

2. How to handle feature-specific modals (e.g., prompt preview for chat)?
   - **Recommendation**: Pass as optional children/render props

3. Should session management be abstracted into the layout?
   - **Recommendation**: No, keep in pages using `useChatSession` hook

4. How to handle different empty states per feature?
   - **Recommendation**: Pass as `emptyState` prop with icon, title, description

## Success Metrics

- [ ] Reduce Chat page from 660 LOC to ~200 LOC (70% reduction)
- [ ] Reduce Collateral page from 716 LOC to ~250 LOC (65% reduction)
- [ ] All existing features work identically
- [ ] No performance regression
- [ ] Contracts V2 can reuse ConversationalLayout
- [ ] Component test coverage >80%
