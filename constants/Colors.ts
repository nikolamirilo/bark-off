// BarkOff Theme Colors and Constants

export const Colors = {
  // Primary colors
  primary: "#F79C23",
  primaryDark: "#E67835",
  primaryLight: "#FFB179",

  // Secondary colors — warm honey/amber pulled from the tutorial artwork
  // (the phone-screen glow). Replaces the prior tropical cyan which clashed
  // with the orange-on-navy brand palette.
  secondary: "#E8A048",
  secondaryDark: "#C98933",
  secondaryLight: "#F2BE6F",

  // Accent colors
  accent: "#FF6B6B",
  success: "#6FCF97",
  warning: "#F2C94C",
  danger: "#FF4136", // Added danger color for delete actions

  // Bark level colors
  levelLow: "#6FCF97", // Green - gentle bark
  levelMedium: "#F2C94C", // Yellow - medium bark
  levelHigh: "#FF6B6B", // Red - loud bark

  // Backgrounds
  backgroundLight: "#FFF9F0",
  backgroundDark: "#1A1A2E",
  cardLight: "#FFFFFF",
  cardDark: "#2D2D44",

  // Text
  textPrimary: "#3D2914",
  textSecondary: "#7D6B5D",
  textLight: "#FFFFFF",
  textMuted: "#9E9E9E",

  // Borders
  border: "#E8E0D5",
  borderDark: "#3D3D5C",

  // Special
  overlay: "rgba(0, 0, 0, 0.5)",
  transparent: "transparent",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 48,
};

export const FontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

// Dog-themed text constants
export const DogText = {
  // App branding
  appName: "BarkOff",
  tagline: "I am your digital com-paw-nion!",

  // Button labels
  startListening: "Start",
  stopListening: "Stop",
  saveRecording: "Save",
  deleteRecording: "Delete",
  addRecording: "Add",

  // Screen titles
  homeTitle: "Ready to Sniff?",
  listeningTitle: "Sniffing for Woofs...",
  recordingsTitle: "Your Calming Woofs",
  reportsTitle: "Bark-tivities",
  settingsTitle: "Paw-ferences",

  // Status messages
  noBarks: "No woofs detected yet! Your pet is being a good boy! 🐾",
  cooldownActive: "Waiting for cooldown...",
  sessionComplete: "Session complete! Report being generated...",

  // Recording states
  tapToRecord: "Tap to record",
  recording: "Recording... Speak to your pet!",
  noRecording: "No recording yet",

  // Level descriptions — short so they read well both as a section header
  // and inside inline alert sentences.
  levelsoftBark: "Soft bark",
  levelLoudBark: "Big bark",

  // Loading states
  loadingData: "Sniffing the data...",
  loadingReports: "Fetching your reports...",
  loadingRecordings: "Digging up recordings...",

  // Success messages
  recordingSaved: "Your clip is ready.",
  reportGenerated: "Woof-derful! Report ready for review!",

  // Empty states
  noReports:
    "No bark-tivities yet! Start a session to create your first report.",
  noRecordings: "Record some calming sounds for your pet!",
};

// Animation durations
export const Animations = {
  fast: 150,
  normal: 300,
  slow: 500,
  pulse: 1000,
};

export default {
  Colors,
  Spacing,
  BorderRadius,
  FontSizes,
  FontWeights,
  DogText,
  Animations,
};
