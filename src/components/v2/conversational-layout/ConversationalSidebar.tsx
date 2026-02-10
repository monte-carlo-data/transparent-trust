"use client";

/**
 * ConversationalSidebar - Reusable collapsible/resizable sidebar
 *
 * Handles sidebar logic (collapse, resize, edge toggle) for both left and right sidebars.
 */

import { Button } from "@/components/ui/button";
import { ResizableDivider } from "@/components/ui/resizable-divider";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { PanelLeftClose, PanelRightClose } from "lucide-react";

export interface ConversationalSidebarProps {
  side: "left" | "right";
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

export function ConversationalSidebar({
  side,
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  footer,
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  containerRef,
}: ConversationalSidebarProps) {
  const {
    panelWidth,
    isDragging,
    containerRef: panelContainerRef,
    handleMouseDown,
  } = useResizablePanel({
    storageKey,
    defaultWidth,
    minWidth,
    maxWidth,
  });

  const CloseIcon = side === "left" ? PanelLeftClose : PanelRightClose;

  if (!isOpen) return null;

  return (
    <>
      {/* Resizable Divider - left side before panel, right side after panel */}
      {side === "right" && (
        <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />
      )}

      <div
        ref={containerRef || panelContainerRef}
        style={{ width: `${panelWidth}px` }}
        className="flex-shrink-0 flex flex-col bg-card border-r transition-all duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(false)}
            title={`Close ${title}`}
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && <div className="border-t">{footer}</div>}
      </div>

      {/* Resizable Divider - left side after panel */}
      {side === "left" && (
        <ResizableDivider isDragging={isDragging} onMouseDown={handleMouseDown} />
      )}
    </>
  );
}
