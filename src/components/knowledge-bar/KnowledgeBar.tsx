"use client";

import { useEffect, useMemo } from "react";
import { useLibraryBarStore } from "@/stores/library-bar-store";
import { useLibraryData } from "@/hooks/use-library-data";
import { getLibraryConfig } from "@/lib/library-config";
import { LibrarySection } from "./LibrarySection";
import { CustomerLibrarySection } from "./CustomerLibrarySection";
import { CustomerSourcesSection } from "./CustomerSourcesSection";
import type { LibraryId } from "@/types/v2/building-block";
import type { Persona } from "@/types/knowledge-bar";

interface KnowledgeBarProps {
  selectedPersona?: Persona | null;
  selectedCustomerId?: string | null;
}

const LIBRARIES: LibraryId[] = ["knowledge", "it", "gtm", "talent"];

export function KnowledgeBar({
  selectedPersona,
  selectedCustomerId,
}: KnowledgeBarProps) {
  // Select stable action refs directly from store (Zustand guarantees stability)
  const setDefaultLibraries = useLibraryBarStore(
    (state) => state.setDefaultLibraries
  );
  const enableCustomerLibrary = useLibraryBarStore(
    (state) => state.enableCustomerLibrary
  );
  const disableCustomerLibrary = useLibraryBarStore(
    (state) => state.disableCustomerLibrary
  );
  const isLibraryEnabled = useLibraryBarStore(
    (state) => state.isLibraryEnabled
  );
  const isLibraryExpanded = useLibraryBarStore(
    (state) => state.isLibraryExpanded
  );
  const toggleLibrary = useLibraryBarStore((state) => state.toggleLibrary);
  const toggleLibraryExpanded = useLibraryBarStore(
    (state) => state.toggleLibraryExpanded
  );
  const customerSourcesEnabled = useLibraryBarStore(
    (state) => state.customerSourcesEnabled
  );
  const customerSourcesExpanded = useLibraryBarStore(
    (state) => state.customerSourcesExpanded
  );
  const toggleCustomerSources = useLibraryBarStore(
    (state) => state.toggleCustomerSources
  );
  const toggleCustomerSourcesExpanded = useLibraryBarStore(
    (state) => state.toggleCustomerSourcesExpanded
  );
  const enableCustomerSources = useLibraryBarStore(
    (state) => state.enableCustomerSources
  );
  const disableCustomerSources = useLibraryBarStore(
    (state) => state.disableCustomerSources
  );

  // Auto-enable Knowledge library on mount
  useEffect(() => {
    setDefaultLibraries();
  }, [setDefaultLibraries]);

  // Auto-enable/disable Customer library and sources based on selection
  useEffect(() => {
    if (selectedCustomerId) {
      enableCustomerLibrary();
      enableCustomerSources();
    } else {
      disableCustomerLibrary();
      disableCustomerSources();
    }
  }, [selectedCustomerId, enableCustomerLibrary, disableCustomerLibrary, enableCustomerSources, disableCustomerSources]);

  // Fetch data for each enabled library
  const knowledgeData = useLibraryData("knowledge", isLibraryEnabled("knowledge"));
  const itData = useLibraryData("it", isLibraryEnabled("it"));
  const gtmData = useLibraryData("gtm", isLibraryEnabled("gtm"));
  const talentData = useLibraryData("talent", isLibraryEnabled("talent"));
  // Customer data is fetched by CustomerLibrarySection
  useLibraryData("customers", isLibraryEnabled("customers"));

  const libraryDataMap = useMemo(
    () => ({
      knowledge: knowledgeData,
      it: itData,
      gtm: gtmData,
      talent: talentData,
    }),
    [knowledgeData, itData, gtmData, talentData]
  );

  return (
    <div className="space-y-3">
      {/* Standard Libraries */}
      {LIBRARIES.map((libraryId) => {
        const isEnabled = isLibraryEnabled(libraryId);
        const isExpanded = isLibraryExpanded(libraryId);
        const config = getLibraryConfig(libraryId);
        const data = libraryDataMap[libraryId as keyof typeof libraryDataMap];

        return (
          <LibrarySection
            key={libraryId}
            libraryId={libraryId}
            config={config}
            isEnabled={isEnabled}
            isExpanded={isExpanded}
            onToggleEnabled={() => toggleLibrary(libraryId)}
            onToggleExpanded={() => toggleLibraryExpanded(libraryId)}
            skills={data.skills}
            documents={data.documents}
            selectedPersona={selectedPersona}
          />
        );
      })}

      {/* Customer Library - only show if customer selected and enabled */}
      {selectedCustomerId && isLibraryEnabled("customers") && (
        <CustomerLibrarySection
          customerId={selectedCustomerId}
          isEnabled={true}
          isExpanded={isLibraryExpanded("customers")}
          onToggleEnabled={() => toggleLibrary("customers")}
          onToggleExpanded={() => toggleLibraryExpanded("customers")}
          selectedPersona={selectedPersona}
        />
      )}

      {/* Customer Sources - only show if customer selected */}
      {selectedCustomerId && (
        <CustomerSourcesSection
          customerId={selectedCustomerId}
          isEnabled={customerSourcesEnabled}
          isExpanded={customerSourcesExpanded}
          onToggleEnabled={toggleCustomerSources}
          onToggleExpanded={toggleCustomerSourcesExpanded}
        />
      )}
    </div>
  );
}
