"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { parseApiData } from "./apiClient";

export type BrandingSettings = {
  appName: string;
  tagline: string;
  sidebarSubtitle: string;
  primaryColor: string;
};

const defaultBranding: BrandingSettings = {
  appName: "Transparent Trust",
  tagline: "Turn your knowledge into trustworthy answers. An LLM-powered assistant telling you not just the answer, but why.",
  sidebarSubtitle: "Transparent LLM Assistant",
  primaryColor: "#0ea5e9",
};

type BrandingContextType = {
  branding: BrandingSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextType>({
  branding: defaultBranding,
  isLoading: true,
  refresh: async () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await fetch("/api/branding");
      if (res.ok) {
        const json = await res.json();
        const data = parseApiData<{ branding?: BrandingSettings }>(json);
        if (data.branding) {
          setBranding(data.branding);
        }
      }
    } catch {
      // Silent failure - branding falls back to defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
