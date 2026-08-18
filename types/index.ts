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
  /**
   * dB **above the room's adaptive noise floor** required to reach this level.
   *
   * This used to be an absolute dBFS value, which could not work: mic AGC
   * normalises the signal upward in quiet rooms, so absolute level doesn't track
   * how loud the room actually is, and any single number is either deaf in a
   * quiet bedroom or permanently triggered in a room with a TV on. Relative dB
   * transfers between rooms. See docs/SENSITIVITY_REVIEW.md.
   *
   * Range 6 (very sensitive) - 24 (only loud barks). Ascending across levels.
   */
  value: number;
}

export interface Settings {
  /** Ascending SNR boundaries, one per bark level. `thresholds[0]` is the trigger. */
  thresholds: BarkThreshold[];
  cooldownSeconds: number;
}

export interface BarkEvent {
  id: string;
  timestamp: Date;
  level: BarkLevel;
  /** Peak absolute level of the burst, dBFS. Kept for report continuity. */
  dBFS: number;
  /** Peak level above the noise floor, dB. The quantity detection acts on. */
  snrDb: number;
  /** Noise floor when the bark started, dBFS. Reveals how noisy the room was. */
  noiseFloorDb: number;
  /** How long the burst lasted, ms. */
  durationMs: number;
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
  /** Mean peak dBFS of barks in this bucket. */
  avgVolume: number;
  /** Mean SNR (dB above the room) of barks in this bucket. */
  avgSnrDb: number;
}

export interface Report {
  id: string;
  sessionId: string;
  generatedAt: Date;

  // Summary stats
  duration: number; // In seconds
  totalBarks: number;
  soundsPlayed: number;

  // Volume stats.
  //
  // Absolute dBFS is retained for continuity with older reports, but it is not a
  // meaningful figure to show a user: mic AGC means the same bark reads
  // differently in different rooms. The SNR figures are the comparable ones.
  averageVolume: number; // dBFS
  peakVolume: number; // dBFS
  /** Mean dB above the room's noise floor across all barks. */
  averageSnrDb: number;
  /** Loudest bark, in dB above the room's noise floor. */
  peakSnrDb: number;
  /** Mean noise floor across all barks — how noisy the room was. */
  averageNoiseFloorDb: number;

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
    { id: "1", name: DogText.levelsoftBark, value: 14 },
    { id: "2", name: DogText.levelLoudBark, value: 24 },
  ],
  cooldownSeconds: 15,
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
