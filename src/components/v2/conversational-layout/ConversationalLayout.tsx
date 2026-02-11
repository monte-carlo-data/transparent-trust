"use client";

/**
 * ConversationalLayout - Main three-panel conversational interface
 *
 * Provides consistent layout for conversational features (Chat, Collateral, Contracts).
 * Eliminates ~550 LOC of duplication between features.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import { ContextControlsBar } from "@/components/v2/config";
import { ChatStatusBar } from "@/components/chat/chat-status-bar";
import { ConversationalSidebar } from "./ConversationalSidebar";
import { MessageBubble } from "./MessageBubble";
import { MessageInputArea } from "./MessageInputArea";
import type { ConversationalLayoutProps } from "./types";

export function ConversationalLayout({
  leftSidebar,
  rightSidebar,
  controlBar,
  messages,
  sessionId,
  onSendMessage,
  isSendingMessage,
  emptyState,
  statusBar,
  input,
  settings,
  onViewTransparency,
}: ConversationalLayoutProps) {
  // Sidebar collapse state
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(
    leftSidebar.defaultOpen ?? true
  );
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(
    rightSidebar.defaultOpen ?? true
  );

  const handleSend = async () => {
    if (!input.value.trim() || input.disabled) return;
    await onSendMessage(input.value);
    input.onChange("");
  };

  const EmptyIcon = emptyState.icon;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden bg-background">
      {/* Top Control Bar */}
      <ContextControlsBar
        selectedPresetId={controlBar.selectedPresetId}
        onPresetChange={controlBar.onPresetChange}
        onUserInstructionsChange={controlBar.onUserInstructionsChange}
        callMode={controlBar.callMode}
        onCallModeChange={controlBar.onCallModeChange}
        customers={controlBar.customers}
        selectedCustomerId={controlBar.selectedCustomerId}
        onCustomerSelect={controlBar.onCustomerSelect}
        customersLoading={controlBar.customersLoading}
        customerDisabled={controlBar.customerDisabled}
        customerDisabledReason={controlBar.customerDisabledReason}
        skills={controlBar.skills}
        onSkillsAutoSelected={controlBar.onSkillsAutoSelected}
        leftContent={controlBar.leftContent}
        rightContent={controlBar.rightContent}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {isLeftSidebarOpen && (
          <ConversationalSidebar
            side="left"
            title={leftSidebar.title}
            icon={leftSidebar.icon}
            isOpen={isLeftSidebarOpen}
            onToggle={setIsLeftSidebarOpen}
            footer={leftSidebar.footer}
            storageKey={leftSidebar.storageKey}
            defaultWidth={leftSidebar.defaultWidth}
            minWidth={leftSidebar.minWidth}
            maxWidth={leftSidebar.maxWidth}
          >
            {leftSidebar.content}
          </ConversationalSidebar>
        )}

        {/* Center - Main Chat Area */}
        <div className="flex flex-1 flex-col min-w-0 bg-background relative">
          {/* Left edge toggle (when collapsed) */}
          {!isLeftSidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLeftSidebarOpen(true)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-24 w-6 rounded-l-none rounded-r-md bg-muted/80 hover:bg-muted border-r border-y"
              title={`Show ${leftSidebar.title}`}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}

          {/* Right edge toggle (when collapsed) */}
          {!isRightSidebarOpen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRightSidebarOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-24 w-6 rounded-r-none rounded-l-md bg-muted/80 hover:bg-muted border-l border-y"
              title={`Show ${rightSidebar.title}`}
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  {EmptyIcon && <EmptyIcon className="h-12 w-12 mx-auto opacity-50" />}
                  <p className="font-medium">{emptyState.title}</p>
                  {typeof emptyState.description === "string" ? (
                    <p className="text-sm">{emptyState.description}</p>
                  ) : (
                    <div className="text-sm">{emptyState.description}</div>
                  )}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  sessionId={sessionId}
                  onViewTransparency={onViewTransparency || (() => {})}
                  onFeedbackChange={() => {}}
                />
              ))
            )}
          </div>

          {/* Status Bar */}
          <ChatStatusBar
            selectedSkillCount={statusBar.selectedSkillCount}
            selectedDocCount={statusBar.selectedDocCount}
            selectedUrlCount={statusBar.selectedUrlCount}
            modelSpeed={statusBar.modelSpeed}
            isLoading={statusBar.isLoading}
            onCustomize={statusBar.onCustomize}
            onPreviewPrompt={statusBar.onPreviewPrompt}
            selectedCustomerName={statusBar.selectedCustomerName}
          />

          {/* Input Area */}
          <MessageInputArea
            value={input.value}
            onChange={input.onChange}
            onSend={handleSend}
            disabled={input.disabled || isSendingMessage}
            placeholder={input.placeholder}
            modelSpeed={settings.modelSpeed}
            onModelSpeedChange={settings.setModelSpeed}
            webSearchEnabled={settings.webSearchEnabled}
            onWebSearchChange={settings.setWebSearchEnabled}
          />
        </div>

        {/* Right Sidebar */}
        {isRightSidebarOpen && (
          <ConversationalSidebar
            side="right"
            title={rightSidebar.title}
            icon={rightSidebar.icon}
            isOpen={isRightSidebarOpen}
            onToggle={setIsRightSidebarOpen}
            footer={rightSidebar.footer}
            storageKey={rightSidebar.storageKey}
            defaultWidth={rightSidebar.defaultWidth}
            minWidth={rightSidebar.minWidth}
            maxWidth={rightSidebar.maxWidth}
          >
            {rightSidebar.content}
          </ConversationalSidebar>
        )}
      </div>

    </div>
  );
}
