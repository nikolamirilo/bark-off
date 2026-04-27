// BarkOff App Types

export type BarkLevel = number; // 1-based index corresponding to threshold level

export interface DogProfile {
  id: string;
  name: string;
  avatarUri?: string;
  createdAt: Date;
}

export interface Recording {
  id: string;
  name: string;
  uri: string;
  duration: number; // In seconds
  level: BarkLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface BarkThreshold {
  id: string;
  name: string;
  value: number; // RMS
}

export interface Settings {
  thresholds: BarkThreshold[];
  cooldownSeconds: number; // Default: 10
  sensitivity: number; // 0.5 - 2.0 multiplier
}

export interface BarkEvent {
  id: string;
  timestamp: Date;
  rms: number;
  dBFS: number;
  level: BarkLevel;
  soundPlayed: boolean;
  recordingId?: string;
}

export interface ListeningSession {
  id: string;
  startedAt: Date;
  endedAt?: Date;
  isActive: boolean;
  events: BarkEvent[];
}

export interface TimelinePoint {
  timestamp: Date;
  barkCount: number;
  avgVolume: number;
}

export interface Report {
  id: string;
  sessionId: string;
  generatedAt: Date;

  // Summary stats
  duration: number; // In seconds
  totalBarks: number;
  soundsPlayed: number;

  // Volume stats
  averageVolume: number; // dBFS
  peakVolume: number; // dBFS

  // Level breakdown - Dynamic keys now
  levelBreakdown: Record<string, number>; // "1", "2", "3", etc.

  // Timeline data for charts
  timeline: TimelinePoint[];

  // Comparison
  comparisonWithPrevious?: {
    barkCountChange: number; // Percentage
    volumeChange: number; // Percentage
    isImprovement: boolean;
  };
}

// Default settings — threshold names come from DogText so relabeling is
// centralized there.
import { DogText } from "@/constants/Colors";

export const DEFAULT_SETTINGS: Settings = {
  thresholds: [
    { id: "1", name: DogText.levelsoftBark, value: -30 },
    { id: "2", name: DogText.levelLoudBark, value: -15 },
  ],
  cooldownSeconds: 15,
  sensitivity: 1.0,
};

export const COOLDOWN_OPTIONS = [5, 10, 15, 20, 30];

// Default dog profile
export const DEFAULT_DOG_PROFILE: DogProfile = {
  id: "default",
  name: "Fur Friend",
  createdAt: new Date(),
};

// Recording slot structure
export interface RecordingSlot {
  id: string;
  level: BarkLevel;
  recording?: Recording;
  isDefault: boolean;
}

// App state for Zustand store
export interface AppState {
  // Dog profile
  dogProfile: DogProfile;
  setDogProfile: (profile: DogProfile) => void;

  // Settings
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;

  // Recordings
  recordings: Recording[];
  addRecording: (recording: Recording) => void;
  updateRecording: (id: string, recording: Partial<Recording>) => void;
  deleteRecording: (id: string) => void;

  // Listening session
  currentSession: ListeningSession | null;
  startSession: () => void;
  endSession: () => void;
  addBarkEvent: (event: BarkEvent) => void;

  // Reports
  reports: Report[];
  addReport: (report: Report) => void;

  // UI state
  isListening: boolean;
  setIsListening: (listening: boolean) => void;

  // Onboarding
  hasSeenTutorial: boolean;
  setHasSeenTutorial: (seen: boolean) => void;
}
