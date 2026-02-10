/**
 * TypeScript types for ConversationalLayout components
 */

import type { InstructionPreset } from "@/components/v2/config";
import type { Customer } from "@/types/v2";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  transparency?: {
    compositionId: string;
    systemPrompt: string;
    model: string;
    blockIds: string[];
    runtimeBlockIds?: string[];
    runtimeContext?: Record<string, unknown>;
    blocksUsed?: Array<{
      id: string;
      title: string;
      content: string;
      libraryId: string;
      blockType?: string;
      entryType?: string;
    }>;
  };
  feedback?: {
    rating?: "THUMBS_UP" | "THUMBS_DOWN" | null;
    comment?: string;
    flaggedForReview?: boolean;
    flagNote?: string;
  };
}

export interface SidebarConfig {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  footer?: React.ReactNode;
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  defaultOpen?: boolean;
}

export interface ControlBarConfig {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
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
}

export interface StatusBarConfig {
  selectedSkillCount: number;
  selectedDocCount: number;
  selectedUrlCount: number;
  modelSpeed: "fast" | "quality";
  isLoading: boolean;
  onCustomize: () => void;
  onPreviewPrompt?: () => void;
  selectedCustomerName: string | null;
}

export interface EmptyStateConfig {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string | React.ReactNode;
}

export interface InputConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface SettingsConfig {
  modelSpeed: "fast" | "quality";
  setModelSpeed: (speed: "fast" | "quality") => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
}

export interface ConversationalLayoutProps {
  // Sidebar Configuration
  leftSidebar: SidebarConfig;
  rightSidebar: SidebarConfig;

  // Top Control Bar
  controlBar: ControlBarConfig;

  // Messages
  messages: Message[];
  sessionId: string | null;

  // Message Handlers
  onSendMessage: (message: string) => Promise<void>;
  isSendingMessage: boolean;

  // Empty State
  emptyState: EmptyStateConfig;

  // Status Bar
  statusBar: StatusBarConfig;

  // Input Area
  input: InputConfig;

  // Settings
  settings: SettingsConfig;

  // Optional Features
  onViewTransparency?: (messageId: string) => void;
}
