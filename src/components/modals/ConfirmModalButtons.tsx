"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ModalVariant, variantButtonClasses } from "./types";

interface ConfirmModalButtonsProps {
  confirmLabel: string;
  cancelLabel: string;
  variant: ModalVariant;
  confirmRef?: React.Ref<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModalButtons({
  confirmLabel,
  cancelLabel,
  variant,
  confirmRef,
  onConfirm,
  onCancel,
}: ConfirmModalButtonsProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        ref={confirmRef}
        onClick={onConfirm}
        className={variantButtonClasses[variant]}
      >
        {confirmLabel}
      </Button>
    </DialogFooter>
  );
}
