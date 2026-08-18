import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  BorderRadius,
  Colors,
  DogText,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { audioService } from "@/services/audioService";
import { normaliseExpoAvMetering } from "@/services/barkDetector";
import { useAppStore, useRecordings, useSettings } from "@/store/appStore";
import {
  BarkLevel,
  COOLDOWN_OPTIONS,
  DEFAULT_SETTINGS,
  Recording,
} from "@/types";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  SENSITIVITY_MAX_DB,
  SENSITIVITY_MIN_DB,
  describeDelta,
  describeNoiseFloor,
  deltaToSensitivityPercent,
} from "./utils";

const IS_ANDROID = Platform.OS === "android";

/**
 * Headroom subtracted from a measured bark so the real thing comfortably clears
 * the threshold. Calibrating exactly at the measured peak means any bark even
 * slightly quieter than the demo one is missed.
 */
const CALIBRATION_MARGIN_DB = 3;

/** Percentile of calibration samples treated as the room's noise floor. */
const FLOOR_PERCENTILE = 0.25;

const percentileOf = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * (sorted.length - 1))),
  );
  return sorted[index];
};

// Display names come exclusively from DogText. Edit DogText.levelsoftBark
// / levelLoudBark to relabel everywhere.
const getBarkLevelLabel = (index: number): string => {
  if (index === 0) return DogText.levelsoftBark;
  if (index === 1) return DogText.levelLoudBark;
  return `Level ${index + 1}`;
};

const formatClipDuration = (seconds?: number): string => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Calibration and voice recording share the same microphone — tracking the
// active operation in a single discriminated union keeps them mutually
// exclusive without prop drilling between two separate cards.
type AudioActivity =
  | { type: "calibrate"; level: BarkLevel }
  | { type: "record"; level: BarkLevel }
  | null;

export function BarkLevelsAndMessagesCard() {
  const settings = useSettings();
  const recordings = useRecordings();
  const {
    addRecording,
    deleteRecording: deleteStoredRecording,
    updateSettings,
  } = useAppStore();

  const [thresholds, setThresholds] = useState(() =>
    Array.isArray(settings.thresholds)
      ? settings.thresholds
      : DEFAULT_SETTINGS.thresholds,
  );
  const safeThresholds = Array.isArray(thresholds)
    ? thresholds
    : DEFAULT_SETTINGS.thresholds;

  const [audioActivity, setAudioActivity] = useState<AudioActivity>(null);
  /** Mirror of audioActivity readable from async callbacks without a stale closure. */
  const audioActivityRef = useRef<AudioActivity>(null);
  /** Live SNR (dB above the measured room floor) during calibration. */
  const [liveSnrDb, setLiveSnrDb] = useState(0);
  const calibrationRecordingRef = useRef<Audio.Recording | null>(null);
  /**
   * All normalised samples from the current calibration run. The room floor and
   * the bark peak both come out of this one pass, which is why the user only has
   * to do one thing: stay quiet, then bark.
   */
  const calibrationSamplesRef = useRef<number[]>([]);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null,
  );

  // Guard against hot-reload leaving thresholds in an invalid shape.
  useEffect(() => {
    if (!Array.isArray(thresholds)) {
      setThresholds(DEFAULT_SETTINGS.thresholds.map((t) => ({ ...t })));
    }
  }, [thresholds]);

  // Adopt the store's thresholds whenever they change underneath us. `persist`
  // rehydrates from AsyncStorage asynchronously, so without this the card can
  // mount showing DEFAULT_SETTINGS and then write those defaults back on the
  // first slider release — silently discarding the user's saved sensitivity.
  useEffect(() => {
    if (Array.isArray(settings.thresholds)) {
      setThresholds(settings.thresholds);
    }
  }, [settings.thresholds]);

  // Voice-recording duration ticker.
  useEffect(() => {
    if (audioActivity?.type !== "record") {
      setVoiceRecordingDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setVoiceRecordingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [audioActivity]);

  useEffect(() => {
    audioActivityRef.current = audioActivity;
  }, [audioActivity]);

  const getRecordingForLevel = (level: BarkLevel): Recording | undefined =>
    recordings.find((r) => r.level === level);

  /**
   * Stop the calibration recorder and delete its file. The clip is only ever read
   * through the meter, never played back, so leaving it behind would accumulate
   * ~1 MB per calibration minute in the cache.
   */
  const stopCalibrationRecording = async (): Promise<void> => {
    const recording = calibrationRecordingRef.current;
    if (!recording) return;
    calibrationRecordingRef.current = null;

    const uri = recording.getURI();
    try {
      recording.setOnRecordingStatusUpdate(null);
      await recording.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
    if (uri) {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        console.warn("Could not delete calibration recording:", error);
      }
    }
  };

  // --- Sensitivity (Step 1) ---

  /**
   * Sliders run directly in dB (inverted, so dragging right = more sensitive)
   * rather than on the 0-100 percentage. 101 percent steps map onto only 19
   * integer dB values, so a percent-driven slider snaps the thumb backwards
   * mid-drag; dB steps are 1:1 with what actually gets stored.
   *
   * The ordering guard is also expressed in dB, where soft must be the *lower*
   * delta. The old percent-space guard collapsed at the top of the range because
   * percentToDB(99) and percentToDB(100) both rounded to the same value.
   */
  const handleSliderChange = (index: number, invertedDb: number) => {
    const deltaDb = SENSITIVITY_MAX_DB + SENSITIVITY_MIN_DB - Math.round(invertedDb);
    const newThresholds = [...safeThresholds];

    // Guard the neighbour lookups: a single-level config (or a partially migrated
    // one) would otherwise dereference an undefined threshold and crash.
    const lowerBound =
      index === 0 ? SENSITIVITY_MIN_DB : newThresholds[index - 1].value + 1;
    const upperBound =
      index >= newThresholds.length - 1
        ? SENSITIVITY_MAX_DB
        : newThresholds[index + 1].value - 1;

    if (lowerBound > upperBound) return;

    newThresholds[index] = {
      ...newThresholds[index],
      value: Math.max(lowerBound, Math.min(upperBound, deltaDb)),
    };
    setThresholds(newThresholds);
  };

  const handleResetThresholds = () => {
    Alert.alert(
      "Reset sensitivity?",
      "Sliders go back to defaults. Recordings stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: () => {
            // Copied, so the store never aliases the module-level default object.
            const defaults = DEFAULT_SETTINGS.thresholds.map((t) => ({ ...t }));
            setThresholds(defaults);
            updateSettings({ thresholds: defaults });
          },
        },
      ],
    );
  };

  const startCalibration = async (levelIndex: number) => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Needed",
          "Microphone access is required for calibration.",
        );
        return;
      }
      await stopCalibrationRecording();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      calibrationSamplesRef.current = [];
      setLiveSnrDb(0);
      setAudioActivity({
        type: "calibrate",
        level: (levelIndex + 1) as BarkLevel,
      });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      calibrationRecordingRef.current = recording;

      // The user can tap stop while createAsync is still in flight, in which case
      // stopCalibration already ran and found a null ref. Shut down immediately
      // rather than leaving the mic open until the next calibration run.
      if (audioActivityRef.current?.type !== "calibrate") {
        await stopCalibrationRecording();
        return;
      }

      recording.setOnRecordingStatusUpdate((status) => {
        if (!status.isRecording || status.metering === undefined) return;
        const db = normaliseExpoAvMetering(status.metering, IS_ANDROID);
        if (db <= -160) return;

        calibrationSamplesRef.current.push(db);
        // Show the live SNR rather than an absolute dB percentage, so the number
        // on screen is the same quantity the detector actually thresholds on.
        const samples = calibrationSamplesRef.current;
        if (samples.length >= 10) {
          const floor = percentileOf(samples, FLOOR_PERCENTILE);
          setLiveSnrDb(Math.max(0, Math.round(db - floor)));
        }
      });
      await recording.setProgressUpdateInterval(50);
    } catch (error) {
      console.error("Error starting calibration:", error);
      Alert.alert("Error", "Could not start calibration recording.");
      setAudioActivity(null);
    }
  };

  /**
   * Derive the threshold from one recording pass: the quiet part gives the room's
   * noise floor, the loud part gives the bark peak, and the threshold is the
   * *difference* minus a little headroom.
   *
   * The old version stored the absolute peak dBFS, which calibrated the mic's AGC
   * state at that moment rather than anything about the bark — so it produced a
   * different answer in every room and stopped matching as soon as the ambient
   * level shifted.
   */
  const stopCalibration = async (levelIndex: number) => {
    try {
      await stopCalibrationRecording();

      const samples = calibrationSamplesRef.current;
      if (samples.length < 20) {
        Alert.alert(
          "Need a moment longer",
          "Hold the button, stay quiet for a second, then mimic a bark.",
        );
        return;
      }

      const floorDb = percentileOf(samples, FLOOR_PERCENTILE);
      const peakDb = samples.reduce((a, b) => (b > a ? b : a), samples[0]);
      const measuredDelta = peakDb - floorDb;

      if (measuredDelta < SENSITIVITY_MIN_DB + CALIBRATION_MARGIN_DB) {
        Alert.alert(
          "Didn't hear a bark",
          `That was only ${Math.round(measuredDelta)} dB above the room ` +
            `(${describeNoiseFloor(floorDb)}). Try again — stay quiet first, ` +
            `then make a clearly louder sound.`,
        );
        return;
      }

      const target = Math.round(measuredDelta) - CALIBRATION_MARGIN_DB;
      const newThresholds = [...safeThresholds];

      // Keep levels ordered: soft below loud.
      const lowerBound =
        levelIndex === 0
          ? SENSITIVITY_MIN_DB
          : newThresholds[levelIndex - 1].value + 1;
      const upperBound =
        levelIndex >= newThresholds.length - 1
          ? SENSITIVITY_MAX_DB
          : newThresholds[levelIndex + 1].value - 1;

      if (lowerBound > upperBound) {
        Alert.alert(
          "No room left",
          `${getBarkLevelLabel(levelIndex)} can't fit between the other levels. ` +
            `Adjust the sliders first.`,
        );
        return;
      }

      const clamped = Math.max(lowerBound, Math.min(upperBound, target));
      newThresholds[levelIndex] = {
        ...newThresholds[levelIndex],
        value: clamped,
      };
      setThresholds(newThresholds);
      updateSettings({ thresholds: newThresholds });

      Alert.alert(
        "Set 🎤",
        `Your bark was ${Math.round(measuredDelta)} dB above the room ` +
          `(${describeNoiseFloor(floorDb)}).\n\n` +
          `${getBarkLevelLabel(levelIndex)} now triggers at +${clamped} dB — ` +
          `${deltaToSensitivityPercent(clamped)}% sensitivity.`,
      );
    } catch (error) {
      console.error("Error stopping calibration:", error);
    } finally {
      setAudioActivity(null);
      setLiveSnrDb(0);
      calibrationSamplesRef.current = [];
    }
  };

  // --- Voice message (Step 2) ---

  const startVoiceRecording = async (level: BarkLevel) => {
    try {
      await audioService.startRecording();
      setAudioActivity({ type: "record", level });
    } catch {
      Alert.alert(
        "Mic blocked",
        "Please allow microphone access in your phone's settings.",
      );
    }
  };

  const stopVoiceRecording = async (level: BarkLevel) => {
    try {
      const result = await audioService.stopRecording();
      if (!result) return;

      const existing = getRecordingForLevel(level);
      if (existing) {
        await audioService.deleteRecording(existing.uri);
        deleteStoredRecording(existing.id);
      }

      const newRecording = await audioService.saveRecording(
        result.uri,
        getBarkLevelLabel(level - 1),
        level,
      );
      addRecording(newRecording);

      // Bump cooldown to the next valid option if the new clip is longer.
      const durationWithBuffer = Math.ceil(newRecording.duration + 2);
      const nextStandard = COOLDOWN_OPTIONS.find(
        (opt) => opt >= durationWithBuffer,
      );
      const newCooldown = nextStandard || durationWithBuffer;

      if (newCooldown > settings.cooldownSeconds) {
        updateSettings({ cooldownSeconds: newCooldown });
        Alert.alert(
          "Saved 🎉",
          `${DogText.recordingSaved} Cooldown raised to ${newCooldown}s so the full clip can play.`,
        );
      } else {
        Alert.alert("Saved 🎉", DogText.recordingSaved);
      }
    } catch (error) {
      Alert.alert("Couldn't save", (error as Error).message);
    } finally {
      setAudioActivity(null);
    }
  };

  const handlePlay = async (recording: Recording) => {
    try {
      if (playingRecordingId === recording.id) {
        await audioService.stopSound();
        setPlayingRecordingId(null);
        return;
      }
      setPlayingRecordingId(recording.id);
      await audioService.playSound(recording.uri);
      setTimeout(() => setPlayingRecordingId(null), recording.duration * 1000);
    } catch (error) {
      console.error("Error playing recording:", error);
      setPlayingRecordingId(null);
    }
  };

  const handleDelete = (recording: Recording) => {
    Alert.alert("Delete this recording?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await audioService.deleteRecording(recording.uri);
          deleteStoredRecording(recording.id);
        },
      },
    ]);
  };

  return (
    <Card title="Bark Levels & Calming Voices" style={styles.card}>
      {safeThresholds.map((threshold, index) => {
        const level = (index + 1) as BarkLevel;
        const recording = getRecordingForLevel(level);
        const isCalibratingThis =
          audioActivity?.type === "calibrate" && audioActivity.level === level;
        const isRecordingThis =
          audioActivity?.type === "record" && audioActivity.level === level;
        const isThisPlaying =
          !!recording && playingRecordingId === recording.id;

        const calibrateDisabled = audioActivity !== null && !isCalibratingThis;
        const recordDisabled = audioActivity !== null && !isRecordingThis;

        return (
          <View key={threshold.id} style={styles.levelBlock}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelName}>{getBarkLevelLabel(index)}</Text>
              <Text style={styles.levelPercent}>
                {deltaToSensitivityPercent(threshold.value)}%
              </Text>
            </View>

            <Text style={styles.stepLine}>
              How much louder than the room a {index === 0 ? "soft" : "big"} bark
              has to be (+{threshold.value} dB)
            </Text>
            {/* Inverted dB: dragging right lowers the required delta. */}
            <Slider
              style={styles.slider}
              minimumValue={SENSITIVITY_MIN_DB}
              maximumValue={SENSITIVITY_MAX_DB}
              step={1}
              value={SENSITIVITY_MAX_DB + SENSITIVITY_MIN_DB - threshold.value}
              onValueChange={(v) => handleSliderChange(index, v)}
              minimumTrackTintColor={Colors.primary}
              onSlidingComplete={() => updateSettings({ thresholds })}
            />
            <Text style={styles.hintLine}>{describeDelta(threshold.value)}</Text>
            <TouchableOpacity
              onPress={() =>
                isCalibratingThis
                  ? stopCalibration(index)
                  : startCalibration(index)
              }
              style={[
                styles.actionButton,
                isCalibratingThis && styles.actionButtonActive,
              ]}
              disabled={calibrateDisabled}
            >
              <Text style={styles.actionIcon}>
                {isCalibratingThis ? "⏹️" : "🎤"}
              </Text>
              <Text
                style={[
                  styles.actionText,
                  isCalibratingThis && styles.actionTextActive,
                ]}
              >
                {isCalibratingThis
                  ? `Listening… +${liveSnrDb} dB above the room`
                  : "Stay quiet, then mimic a bark"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.stepLine}>
              Voice that plays when {index === 0 ? "soft" : "big"} bark is
              detected
            </Text>
            {recording && !isRecordingThis && (
              <View style={styles.playerRow}>
                <TouchableOpacity
                  onPress={() => handlePlay(recording)}
                  style={styles.playButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.playIcon}>
                    {isThisPlaying ? "⏸️" : "▶️"}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.clipName} numberOfLines={1}>
                  {getBarkLevelLabel(index)} ·{" "}
                  {formatClipDuration(recording.duration)}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(recording)}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              onPress={() =>
                isRecordingThis
                  ? stopVoiceRecording(level)
                  : startVoiceRecording(level)
              }
              style={[
                styles.actionButton,
                isRecordingThis && styles.actionButtonActive,
              ]}
              disabled={recordDisabled}
            >
              <Text style={styles.actionIcon}>
                {isRecordingThis ? "⏹️" : "🎙️"}
              </Text>
              <Text
                style={[
                  styles.actionText,
                  isRecordingThis && styles.actionTextActive,
                ]}
              >
                {isRecordingThis
                  ? `Recording… ${formatClipDuration(voiceRecordingDuration)}`
                  : recording
                    ? "Re-record"
                    : "Record your voice"}
              </Text>
            </TouchableOpacity>

            {index < safeThresholds.length - 1 && (
              <View style={styles.separator} />
            )}
          </View>
        );
      })}

      <Button
        title="Reset to defaults"
        onPress={handleResetThresholds}
        variant="secondary"
        style={{ marginTop: Spacing.md }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  levelBlock: { marginBottom: Spacing.sm },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  levelName: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    fontWeight: FontWeights.semibold,
  },
  levelPercent: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
  },
  stepLine: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  slider: { width: "100%", height: 40 },
  hintLine: {
    fontSize: FontSizes.xs,
    color: Colors.textLight,
    fontStyle: "italic",
    marginBottom: Spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundLight,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  actionButtonActive: {
    backgroundColor: Colors.accent + "20",
    borderColor: Colors.accent,
  },
  actionIcon: { fontSize: FontSizes.lg },
  actionText: {
    fontSize: FontSizes.sm,
    color: Colors.secondary,
    fontWeight: FontWeights.semibold,
  },
  actionTextActive: { color: Colors.accent },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { fontSize: FontSizes.md },
  clipName: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeights.medium,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIcon: { fontSize: FontSizes.md },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.md,
  },
});
