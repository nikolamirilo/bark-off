import { DogText } from "@/constants/Colors";
import {
  AppState,
  BarkEvent,
  DEFAULT_DOG_PROFILE,
  DEFAULT_SETTINGS,
  DogProfile,
  Recording,
  Report,
  Settings,
} from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Generate unique IDs
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Dog profile
      dogProfile: DEFAULT_DOG_PROFILE,
      setDogProfile: (profile: DogProfile) => set({ dogProfile: profile }),

      // Settings
      settings: DEFAULT_SETTINGS,
      updateSettings: (newSettings: Partial<Settings>) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Recordings
      recordings: [],
      addRecording: (recording: Recording) =>
        set((state) => ({
          recordings: [...state.recordings, recording],
        })),
      updateRecording: (id: string, updates: Partial<Recording>) =>
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date() } : r,
          ),
        })),
      deleteRecording: (id: string) =>
        set((state) => ({
          recordings: state.recordings.filter((r) => r.id !== id),
        })),

      // Listening session
      currentSession: null,
      startSession: () =>
        set({
          currentSession: {
            id: generateId(),
            startedAt: new Date(),
            isActive: true,
            events: [],
          },
          isListening: true,
        }),
      endSession: () =>
        set((state) => ({
          currentSession: state.currentSession
            ? { ...state.currentSession, endedAt: new Date(), isActive: false }
            : null,
          isListening: false,
        })),
      addBarkEvent: (event: BarkEvent) =>
        set((state) => ({
          currentSession: state.currentSession
            ? {
                ...state.currentSession,
                events: [...state.currentSession.events, event],
              }
            : null,
        })),

      // Reports
      reports: [],
      addReport: (report: Report) =>
        set((state) => ({
          reports: [report, ...state.reports], // Newest first
        })),

      // UI state
      isListening: false,
      setIsListening: (listening: boolean) => set({ isListening: listening }),

      // Onboarding
      hasSeenTutorial: false,
      setHasSeenTutorial: (seen: boolean) => set({ hasSeenTutorial: seen }),
    }),
    {
      name: "bark-off-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dogProfile: state.dogProfile,
        settings: state.settings,
        recordings: state.recordings,
        reports: state.reports,
        hasSeenTutorial: state.hasSeenTutorial,
      }),
      version: 5,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migration from v0 to v1: convert thresholds object to array
          if (
            persistedState.settings &&
            persistedState.settings.thresholds &&
            !Array.isArray(persistedState.settings.thresholds)
          ) {
            const old = persistedState.settings.thresholds;
            persistedState.settings.thresholds = [
              { id: "1", name: DogText.levelsoftBark, value: -30 },
              { id: "2", name: DogText.levelLoudBark, value: -15 },
            ];
          }
        }
        if (version < 3) {
          // Migration to v3: fix to 2 levels with dBFS values
          // Any existing RMS values (positive numbers) get replaced with dBFS defaults
          if (
            persistedState.settings &&
            Array.isArray(persistedState.settings.thresholds)
          ) {
            const existing = persistedState.settings.thresholds;
            const val0 = existing[0]?.value;
            const val1 = existing[1]?.value;
            // If values are positive, they're RMS — convert to defaults
            const isRMS = (v: number) => v > 0;
            persistedState.settings.thresholds = [
              {
                id: "1",
                name: DogText.levelsoftBark,
                value: val0 !== undefined && !isRMS(val0) ? val0 : -30,
              },
              {
                id: "2",
                name: DogText.levelLoudBark,
                value: val1 !== undefined && !isRMS(val1) ? val1 : -15,
              },
            ];
          } else {
            persistedState.settings = persistedState.settings || {};
            persistedState.settings.thresholds = [
              { id: "1", name: DogText.levelsoftBark, value: -30 },
              { id: "2", name: DogText.levelLoudBark, value: -15 },
            ];
          }
        }
        if (version < 5) {
          // Migration to v5: thresholds changed from absolute dBFS (negative) to
          // dB above the adaptive noise floor (positive, 6-24). Absolute values
          // carry no information about what the user actually wanted — the whole
          // point of the change is that absolute level was never a usable
          // measure — so reset to defaults rather than mapping them across.
          //
          // Fill from DEFAULT_SETTINGS rather than {}: the earlier branches above
          // can produce a settings object with thresholds but no cooldownSeconds,
          // and an undefined cooldown makes the remaining-cooldown arithmetic NaN.
          // `NaN <= 0` is false, so playback would be silently disabled forever.
          persistedState.settings = {
            ...DEFAULT_SETTINGS,
            ...(persistedState.settings || {}),
            // Deep-copied so the store never aliases the module-level default.
            thresholds: DEFAULT_SETTINGS.thresholds.map((t) => ({ ...t })),
          };
          // Retired: was a documented 0.5-2.0 multiplier that nothing ever wrote,
          // so it sat at 1.0 and its dB offset was permanently zero.
          delete persistedState.settings.sensitivity;
        }
        return persistedState as AppState;
      },
    },
  ),
);

// Helper selectors
export const useSettings = () => useAppStore((state) => state.settings);
export const useDogProfile = () => useAppStore((state) => state.dogProfile);
export const useRecordings = () => useAppStore((state) => state.recordings);
export const useReports = () => useAppStore((state) => state.reports);
export const useCurrentSession = () =>
  useAppStore((state) => state.currentSession);
export const useIsListening = () => useAppStore((state) => state.isListening);

// Get recording by level
export const useRecordingByLevel = (level: number) =>
  useAppStore((state) => state.recordings.find((r) => r.level === level));
