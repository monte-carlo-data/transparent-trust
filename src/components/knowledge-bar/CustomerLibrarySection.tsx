"use client";

import { useMemo } from "react";
import { useCustomerSkills } from "@/hooks/use-customer-skills";
import { LibrarySection } from "./LibrarySection";
import { getLibraryConfig } from "@/lib/library-config";
import type { Persona } from "@/types/knowledge-bar";

interface CustomerLibrarySectionProps {
  customerId: string;
  isEnabled: boolean;
  isExpanded: boolean;
  onToggleEnabled: () => void;
  onToggleExpanded: () => void;
  selectedPersona?: Persona | null;
}

export function CustomerLibrarySection({
  customerId,
  isEnabled,
  isExpanded,
  onToggleEnabled,
  onToggleExpanded,
  selectedPersona,
}: CustomerLibrarySectionProps) {
  // Fetch skills scoped to this customer across all libraries
  const { skills } = useCustomerSkills(customerId, { enabled: isEnabled });

  // For now, customer library doesn't have separate documents concept
  // Customer skills are the primary content type
  const documents: never[] = useMemo(() => [], []);

  const config = getLibraryConfig("customers");

  return (
    <LibrarySection
      libraryId="customers"
      config={config}
      isEnabled={isEnabled}
      isExpanded={isExpanded}
      onToggleEnabled={onToggleEnabled}
      onToggleExpanded={onToggleExpanded}
      skills={skills}
      documents={documents}
      selectedPersona={selectedPersona}
    />
  );
}
