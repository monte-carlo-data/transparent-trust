"use client";

// Re-export from the new unified loading components
// This maintains backward compatibility with existing imports
export { CardLoader as default } from "./ui/loading";

// Also export the new components for direct import
export { InlineLoader, PageLoader, CardLoader, ButtonLoader } from "./ui/loading";
