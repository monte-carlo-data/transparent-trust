"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type UseResizablePanelOptions = {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
};

export function useResizablePanel({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizablePanelOptions) {
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return defaultWidth;
    }
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const width = parseInt(saved, 10);
      if (width >= minWidth && width <= maxWidth) {
        return width;
      }
    }
    return defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle drag move
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      setPanelWidth(clampedWidth);
    },
    [isDragging, minWidth, maxWidth]
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem(storageKey, panelWidth.toString());
    }
  }, [isDragging, panelWidth, storageKey]);

  // Add global mouse listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    panelWidth,
    isDragging,
    containerRef,
    handleMouseDown,
    minWidth,
    maxWidth,
  };
}
