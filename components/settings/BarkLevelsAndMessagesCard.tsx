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
import { useAppStore, useRecordings, useSettings } from "@/store/appStore";
import {
  BarkLevel,
  COOLDOWN_OPTIONS,
  DEFAULT_SETTINGS,
  Recording,
} from "@/types";
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { dBToPercent, percentToDB } from "./utils";

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
  const [peakDB, setPeakDB] = useState(-160);
  const calibrationRecordingRef = useRef<Audio.Recording | null>(null);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null,
  );

  // Guard against hot-reload leaving thresholds in an invalid shape.
  useEffect(() => {
    if (!Array.isArray(thresholds)) {
      setThresholds(DEFAULT_SETTINGS.thresholds);
    }
  }, [thresholds]);

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

  const getRecordingForLevel = (level: BarkLevel): Recording | undefined =>
    recordings.find((r) => r.level === level);

  // --- Sensitivity (Step 1) ---

  const handleSliderChange = (index: number, value: number) => {
    const newThresholds = [...thresholds];
    if (index === 0) {
      newThresholds[0] = {
        ...newThresholds[0],
        value: Math.min(value, percentToDB(99)),
      };
    } else if (index === 1) {
      const minLevel2 = newThresholds[0].value;
      newThresholds[1] = {
        ...newThresholds[1],
        value: Math.max(value, minLevel2),
      };
    }
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
            setThresholds(DEFAULT_SETTINGS.thresholds);
            updateSettings({ thresholds: DEFAULT_SETTINGS.thresholds });
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
      if (calibrationRecordingRef.current) {
        try {
          calibrationRecordingRef.current.setOnRecordingStatusUpdate(null);
          await calibrationRecordingRef.current.stopAndUnloadAsync();
        } catch {
          // already stopped
        }
        calibrationRecordingRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      setPeakDB(-160);
      setAudioActivity({
        type: "calibrate",
        level: (levelIndex + 1) as BarkLevel,
      });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      calibrationRecordingRef.current = recording;

      let localPeak = -160;
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording && status.metering !== undefined) {
          if (status.metering > localPeak) {
            localPeak = status.metering;
            setPeakDB(Math.round(localPeak));
          }
        }
      });
      await recording.setProgressUpdateInterval(100);
    } catch (error) {
      console.error("Error starting calibration:", error);
      Alert.alert("Error", "Could not start calibration recording.");
      setAudioActivity(null);
    }
  };

  const stopCalibration = async (levelIndex: number) => {
    try {
      const recording = calibrationRecordingRef.current;
      if (recording) {
        recording.setOnRecordingStatusUpdate(null);
        await recording.stopAndUnloadAsync();
        calibrationRecordingRef.current = null;
      }

      if (peakDB > -160) {
        const newThresholds = [...thresholds];
        const otherIndex = levelIndex === 0 ? 1 : 0;
        const otherValue = newThresholds[otherIndex].value;

        if (levelIndex === 0 && peakDB >= otherValue) {
          Alert.alert(
            "Too loud",
            `${getBarkLevelLabel(0)} must be quieter than ${getBarkLevelLabel(
              1,
            )} (${dBToPercent(otherValue)}%). Try a gentler sound.`,
          );
        } else if (levelIndex === 1 && peakDB <= newThresholds[0].value) {
          Alert.alert(
            "Too quiet",
            `${getBarkLevelLabel(1)} must be louder than ${getBarkLevelLabel(
              0,
            )}. Try a louder sound.`,
          );
        } else {
          const clampedValue = Math.max(-60, Math.min(-10, peakDB));
          newThresholds[levelIndex] = {
            ...newThresholds[levelIndex],
            value: clampedValue,
          };
          setThresholds(newThresholds);
          updateSettings({ thresholds: newThresholds });
          Alert.alert(
            "Set 🎤",
            `${getBarkLevelLabel(levelIndex)} set to ${dBToPercent(
              clampedValue,
            )}%.`,
          );
        }
      } else {
        Alert.alert("Didn't hear anything", "Try again with a louder bark.");
      }
    } catch (error) {
      console.error("Error stopping calibration:", error);
    } finally {
      setAudioActivity(null);
      setPeakDB(-160);
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
                {dBToPercent(threshold.value)}%
              </Text>
            </View>

            <Text style={styles.stepLine}>
              How loud a {threshold.id === "1" ? "soft" : "big"} bark has to be
              to trigger
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={percentToDB(1)}
              maximumValue={percentToDB(100)}
              step={1}
              value={threshold.value}
              onValueChange={(v) => handleSliderChange(index, v)}
              minimumTrackTintColor={
                index === 1 && threshold.value === thresholds[0].value
                  ? Colors.textLight
                  : Colors.primary
              }
              onSlidingComplete={() => updateSettings({ thresholds })}
            />
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
                  ? `Listening… Peak ${dBToPercent(peakDB)}%`
                  : "Mimic a bark to set sensitivity"}
              </Text>
            </TouchableOpacity>
            <Text style={styles.stepLine}>
              Voice that plays when {threshold.id === "1" ? "soft" : "big"} bark
              is detected
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
