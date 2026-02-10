"use client";

type ResizableDividerProps = {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
};

export function ResizableDivider({ isDragging, onMouseDown }: ResizableDividerProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        w-1.5 cursor-col-resize flex-shrink-0 relative
        transition-colors duration-150
        ${isDragging ? "bg-primary" : "bg-border hover:bg-muted-foreground/30"}
      `}
    >
      {/* Visual grip indicator */}
      <div
        className={`
          absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-0.5 h-8 rounded-full
          transition-colors duration-150
          ${isDragging ? "bg-primary-foreground" : "bg-muted-foreground/50"}
        `}
      />
    </div>
  );
}
