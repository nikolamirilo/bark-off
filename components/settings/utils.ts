// Thresholds are stored as dB above the room's adaptive noise floor (6-24), not
// as absolute dBFS. Absolute level can't be a threshold — mic AGC normalises it
// upward in quiet rooms, so it doesn't track how loud the room really is. See
// docs/SENSITIVITY_REVIEW.md.
//
// The percent <-> dB conversions live in barkDetector.ts (single source of truth,
// covered by services/__tests__/barkDetector.test.ts) and are re-exported here so
// UI code has one obvious import.
export {
  SENSITIVITY_MAX_DB,
  SENSITIVITY_MIN_DB,
  deltaToSensitivityPercent,
  sensitivityPercentToDelta,
} from "@/services/barkDetector";

/**
 * Plain-language description of a threshold, so the number means something to a
 * user who has no reason to know what a decibel is.
 */
export const describeDelta = (deltaDb: number): string => {
  if (deltaDb <= 9) return "Very sensitive — picks up whines and grumbles";
  if (deltaDb <= 14) return "Balanced — normal barks";
  if (deltaDb <= 19) return "Relaxed — clear, deliberate barks";
  return "Strict — only loud barking";
};

/**
 * Describe how noisy the room is, from the measured noise floor. Used by the
 * calibration readout and session reports to explain *why* detection behaves
 * differently in different rooms.
 */
export const describeNoiseFloor = (floorDb: number): string => {
  if (floorDb < -50) return "very quiet room";
  if (floorDb < -40) return "quiet room";
  if (floorDb < -30) return "some background noise";
  if (floorDb < -22) return "noisy room";
  return "very noisy room";
};
