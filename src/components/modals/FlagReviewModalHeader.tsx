"use client";

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FlagReviewModalHeader() {
  return (
    <DialogHeader>
      <DialogTitle>Flag or Request Review</DialogTitle>
      <DialogDescription>
        Mark this answer for attention or get help from a colleague.
      </DialogDescription>
    </DialogHeader>
  );
}
