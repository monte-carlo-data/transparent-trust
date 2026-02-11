"use client";

import { useCallback, useState, useRef } from "react";
import { ConfirmModalContent } from "./modals/ConfirmModalContent";
import { PromptModalContent } from "./modals/PromptModalContent";
import { TextareaPromptModalContent } from "./modals/TextareaPromptModalContent";
import { ModalVariant, variantColors } from "./modals/types";

export type { ModalVariant };
export { variantColors };

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal(props: ConfirmModalProps) {
  return <ConfirmModalContent {...props} />;
}

// Hook for easier usage with async/await pattern
interface UseConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

interface UseConfirmReturn {
  confirm: (options?: Partial<UseConfirmOptions>) => Promise<boolean>;
  ConfirmDialog: React.FC;
}

export function useConfirm(defaultOptions: UseConfirmOptions): UseConfirmReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (overrideOptions?: Partial<UseConfirmOptions>): Promise<boolean> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(false);
  }, []);

  const ConfirmDialog: React.FC = useCallback(
    () => (
      <ConfirmModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmLabel={options.confirmLabel}
        cancelLabel={options.cancelLabel}
        variant={options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleConfirm, handleCancel]
  );

  return { confirm, ConfirmDialog };
}

// ============================================
// PROMPT MODAL (for text input)
// ============================================

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal(props: PromptModalProps) {
  return <PromptModalContent {...props} />;
}

// Hook for easier usage with async/await pattern
interface UsePromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

interface UsePromptReturn {
  prompt: (options?: Partial<UsePromptOptions>) => Promise<string | null>;
  PromptDialog: React.FC;
}

export function usePrompt(defaultOptions: UsePromptOptions): UsePromptReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptFn = useCallback(
    (overrideOptions?: Partial<UsePromptOptions>): Promise<string | null> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleSubmit = useCallback((value: string) => {
    setIsOpen(false);
    resolveRef.current?.(value);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const PromptDialog: React.FC = useCallback(
    () => (
      <PromptModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        placeholder={options.placeholder}
        defaultValue={options.defaultValue}
        submitLabel={options.submitLabel}
        cancelLabel={options.cancelLabel}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleSubmit, handleCancel]
  );

  return { prompt: promptFn, PromptDialog };
}

// ============================================
// TEXTAREA PROMPT MODAL (for multiline input)
// ============================================

interface TextareaPromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function TextareaPromptModal(props: TextareaPromptModalProps) {
  return <TextareaPromptModalContent {...props} />;
}

// Hook for textarea prompt with async/await
interface UseTextareaPromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}

interface UseTextareaPromptReturn {
  prompt: (options?: Partial<UseTextareaPromptOptions>) => Promise<string | null>;
  TextareaPromptDialog: React.FC;
}

export function useTextareaPrompt(defaultOptions: UseTextareaPromptOptions): UseTextareaPromptReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState(defaultOptions);
  const resolveRef = useRef<((value: string | null) => void) | null>(null);

  const promptFn = useCallback(
    (overrideOptions?: Partial<UseTextareaPromptOptions>): Promise<string | null> => {
      setOptions({ ...defaultOptions, ...overrideOptions });
      setIsOpen(true);
      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [defaultOptions]
  );

  const handleSubmit = useCallback((value: string) => {
    setIsOpen(false);
    resolveRef.current?.(value);
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolveRef.current?.(null);
  }, []);

  const TextareaPromptDialog: React.FC = useCallback(
    () => (
      <TextareaPromptModal
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        placeholder={options.placeholder}
        defaultValue={options.defaultValue}
        submitLabel={options.submitLabel}
        cancelLabel={options.cancelLabel}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    ),
    [isOpen, options, handleSubmit, handleCancel]
  );

  return { prompt: promptFn, TextareaPromptDialog };
}
