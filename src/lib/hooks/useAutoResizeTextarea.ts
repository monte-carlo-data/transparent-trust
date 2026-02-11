import { useEffect, useRef } from 'react';

/**
 * Hook for auto-resizing textarea elements
 * Expands textarea as user types, up to a maximum height
 */
export function useAutoResizeTextarea(value: string, maxHeight = 400) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the scroll height
    textarea.style.height = 'auto';

    // Set height based on scroll height, but cap at maxHeight
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [value, maxHeight]);

  return textareaRef;
}
