// Convert between dBFS (-60..-10) and a user-friendly 1-100% scale so sliders
// and calibrated peaks can be displayed with a single unit. Normal speech
// lands around 40-60%, loud barks 70-85%, screaming approaches 100%.

export const dBToPercent = (dB: number): number => {
  const pct = Math.round(((dB + 60) / 50) * 100);
  return Math.max(1, Math.min(100, pct));
};

export const percentToDB = (pct: number): number => {
  const clampedPct = Math.max(1, Math.min(100, pct));
  return Math.round((clampedPct / 100) * 50 - 60);
};
