import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LibraryId } from '@/types/v2/building-block';

interface LibraryBarState {
  // Per-library enabled state (which libraries are visible)
  libraryEnabled: Map<LibraryId, boolean>;

  // Per-library expanded state (only matters if enabled)
  libraryExpanded: Map<LibraryId, boolean>;

  // Customer sources section state (separate from customer library)
  customerSourcesEnabled: boolean;
  customerSourcesExpanded: boolean;

  // Actions
  enableLibrary: (id: LibraryId) => void;
  disableLibrary: (id: LibraryId) => void;
  toggleLibrary: (id: LibraryId) => void;
  expandLibrary: (id: LibraryId) => void;
  collapseLibrary: (id: LibraryId) => void;
  toggleLibraryExpanded: (id: LibraryId) => void;

  // Customer sources actions
  enableCustomerSources: () => void;
  disableCustomerSources: () => void;
  toggleCustomerSources: () => void;
  toggleCustomerSourcesExpanded: () => void;

  // Bulk operations
  setDefaultLibraries: () => void; // Enable "Knowledge" by default
  enableCustomerLibrary: () => void; // Enable "Customers" when customer selected
  disableCustomerLibrary: () => void; // Disable when customer deselected

  // Getters
  isLibraryEnabled: (id: LibraryId) => boolean;
  isLibraryExpanded: (id: LibraryId) => boolean;
  getEnabledLibraries: () => LibraryId[];
}

const DEFAULT_LIBRARIES: LibraryId[] = ['knowledge', 'it', 'gtm', 'talent', 'customers', 'prompts', 'personas', 'templates'];

export const useLibraryBarStore = create<LibraryBarState>()(
  persist(
    (set, get) => ({
      // Initial state
      libraryEnabled: new Map(
        DEFAULT_LIBRARIES.map((lib) => [lib, lib === 'knowledge'])
      ),
      libraryExpanded: new Map(
        DEFAULT_LIBRARIES.map((lib) => [lib, lib === 'knowledge'])
      ),
      customerSourcesEnabled: false,
      customerSourcesExpanded: false,

      // Actions
      enableLibrary: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryEnabled);
          newMap.set(id, true);
          return { libraryEnabled: newMap };
        }),

      disableLibrary: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryEnabled);
          newMap.set(id, false);
          return { libraryEnabled: newMap };
        }),

      toggleLibrary: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryEnabled);
          newMap.set(id, !newMap.get(id));
          return { libraryEnabled: newMap };
        }),

      expandLibrary: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryExpanded);
          newMap.set(id, true);
          return { libraryExpanded: newMap };
        }),

      collapseLibrary: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryExpanded);
          newMap.set(id, false);
          return { libraryExpanded: newMap };
        }),

      toggleLibraryExpanded: (id) =>
        set((state) => {
          const newMap = new Map(state.libraryExpanded);
          newMap.set(id, !newMap.get(id));
          return { libraryExpanded: newMap };
        }),

      // Customer sources actions
      enableCustomerSources: () =>
        set({ customerSourcesEnabled: true, customerSourcesExpanded: true }),

      disableCustomerSources: () =>
        set({ customerSourcesEnabled: false }),

      toggleCustomerSources: () =>
        set((state) => ({
          customerSourcesEnabled: !state.customerSourcesEnabled,
        })),

      toggleCustomerSourcesExpanded: () =>
        set((state) => ({
          customerSourcesExpanded: !state.customerSourcesExpanded,
        })),

      // Bulk operations
      setDefaultLibraries: () =>
        set({
          libraryEnabled: new Map(
            DEFAULT_LIBRARIES.map((lib) => [lib, lib === 'knowledge'])
          ),
          libraryExpanded: new Map(
            DEFAULT_LIBRARIES.map((lib) => [lib, lib === 'knowledge'])
          ),
        }),

      enableCustomerLibrary: () =>
        set((state) => {
          const newMap = new Map(state.libraryEnabled);
          newMap.set('customers', true);
          const expandedMap = new Map(state.libraryExpanded);
          expandedMap.set('customers', true);
          return { libraryEnabled: newMap, libraryExpanded: expandedMap };
        }),

      disableCustomerLibrary: () =>
        set((state) => {
          const newMap = new Map(state.libraryEnabled);
          newMap.set('customers', false);
          return { libraryEnabled: newMap };
        }),

      // Getters
      isLibraryEnabled: (id) => {
        const { libraryEnabled } = get();
        return libraryEnabled.get(id) || false;
      },

      isLibraryExpanded: (id) => {
        const { libraryExpanded } = get();
        return libraryExpanded.get(id) || false;
      },

      getEnabledLibraries: () => {
        const { libraryEnabled } = get();
        return Array.from(libraryEnabled.entries())
          .filter(([, enabled]) => enabled)
          .map(([id]) => id);
      },
    }),
    {
      name: 'library-bar-store',
      storage: createJSONStorage(() => localStorage, {
        // Custom serializer to handle Map objects
        reviver: (key, value) => {
          if (key === 'libraryEnabled' || key === 'libraryExpanded') {
            // Convert array of entries back to Map
            if (Array.isArray(value)) {
              return new Map(value);
            }
            // Handle legacy object format
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              return new Map(Object.entries(value));
            }
          }
          return value;
        },
        replacer: (key, value) => {
          if (value instanceof Map) {
            // Convert Map to array of entries for JSON serialization
            return Array.from(value.entries());
          }
          return value;
        },
      }),
    }
  )
);
