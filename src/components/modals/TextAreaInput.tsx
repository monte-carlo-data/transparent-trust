"use client";

import { useEffect, useRef } from "react";

interface TextAreaInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function TextAreaInput({
  placeholder,
  value,
  onChange,
  autoFocus = true,
}: TextAreaInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const timeout = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(timeout);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg min-h-[150px] resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  );
}
