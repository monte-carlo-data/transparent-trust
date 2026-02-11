import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  // Model selection
  modelSpeed: "fast" | "quality";
  setModelSpeed: (speed: "fast" | "quality") => void;

  // Call mode (ultra-concise responses)
  callMode: boolean;
  setCallMode: (enabled: boolean) => void;

  // Web search toggle
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;

  // Instruction preset selection
  selectedPresetId: string | null;
  setSelectedPresetId: (id: string | null) => void;

  // Custom user instructions
  userInstructions: string;
  setUserInstructions: (instructions: string) => void;

  // Compact mode for display
  compactMode: boolean;
  setCompactMode: (enabled: boolean) => void;

  // Reset all settings to defaults
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  modelSpeed: "quality" as const,
  callMode: false,
  webSearchEnabled: false,
  selectedPresetId: null,
  userInstructions: "",
  compactMode: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setModelSpeed: (speed) => set({ modelSpeed: speed }),
      setCallMode: (enabled) => set({ callMode: enabled }),
      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
      setSelectedPresetId: (id) => set({ selectedPresetId: id }),
      setUserInstructions: (instructions) =>
        set({ userInstructions: instructions }),
      setCompactMode: (enabled) => set({ compactMode: enabled }),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "chat-settings-store",
      version: 1,
    }
  )
);
