import {
  BorderRadius,
  Colors,
  DogText,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  duration?: number; // Current recording duration in seconds
}

export function RecordButton({
  isRecording,
  onPress,
  duration = 0,
}: RecordButtonProps) {
  const scale = useSharedValue(1);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      // Pulse animation when recording
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );

      // Ring expanding animation
      ringScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 0 }),
          withTiming(1.5, { duration: 1000 }),
        ),
        -1,
      );
      ringOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 0 }),
          withTiming(0, { duration: 1000 }),
        ),
        -1,
      );
    } else {
      scale.value = withSpring(1);
      ringScale.value = withSpring(1);
      ringOpacity.value = withSpring(0);
    }
  }, [isRecording]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, ringStyle]} />
      <Animated.View style={[styles.button, buttonStyle]}>
        <View
          style={[
            styles.innerButton,
            isRecording && styles.innerButtonRecording,
          ]}
        >
          {isRecording ? (
            <View style={styles.stopIcon} />
          ) : (
            <Text style={styles.micIcon}>🎙️</Text>
          )}
        </View>
      </Animated.View>
      <Text style={styles.label}>
        {isRecording ? formatDuration(duration) : "Tap to record"}
      </Text>
    </View>
  );
}

interface RecordingSlotProps {
  slotNumber: number;
  hasRecording: boolean;
  recordingName?: string;
  recordingDuration?: number;
  isPlaying?: boolean;
  onPlay: () => void;
  onRecord: () => void;
  onDelete: () => void;
}

export function RecordingSlot({
  slotNumber,
  hasRecording,
  recordingName,
  recordingDuration,
  isPlaying,
  onPlay,
  onRecord,
  onDelete,
}: RecordingSlotProps) {
  const getLevelName = (level: number) => {
    switch (level) {
      case 1:
        return DogText.levelsoftBark;
      case 2:
        return DogText.levelLoudBark;
      default:
        return `Level ${level}`;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.slotContainer}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotTitle}>
          Level {slotNumber}: {getLevelName(slotNumber)}
        </Text>
      </View>

      <View style={styles.slotContent}>
        {hasRecording ? (
          <>
            <View style={styles.recordingInfo}>
              <Text style={styles.playIcon} onPress={onPlay}>
                {isPlaying ? "⏸️" : "▶️"}
              </Text>
              <View style={styles.recordingDetails}>
                <Text style={styles.recordingName}>
                  {recordingName || "Recording"}
                </Text>
                <Text style={styles.recordingDuration}>
                  Duration: {formatDuration(recordingDuration)}
                </Text>
              </View>
            </View>
            <View style={styles.slotActions}>
              <Text style={styles.actionButton} onPress={onRecord}>
                Re-record
              </Text>
              <Text
                style={[styles.actionButton, styles.deleteButton]}
                onPress={onDelete}
              >
                Delete
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptySlot}>
            <Text style={styles.micIconLarge} onPress={onRecord}>
              🎙️
            </Text>
            <Text style={styles.emptySlotText}>Tap to record</Text>
            <Text style={styles.emptySlotSubtext}>No recording yet</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.md,
  },
  ring: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  button: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  innerButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  innerButtonRecording: {
    backgroundColor: Colors.accent,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: Colors.cardLight,
    borderRadius: 4,
  },
  micIcon: {
    fontSize: 32,
  },
  label: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: FontWeights.medium,
  },
  // Recording Slot styles
  slotContainer: {
    backgroundColor: Colors.cardLight,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  slotHeader: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  slotTitle: {
    color: Colors.textLight,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  slotContent: {
    padding: Spacing.md,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  playIcon: {
    fontSize: 32,
  },
  recordingDetails: {
    flex: 1,
  },
  recordingName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  recordingDuration: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  slotActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionButton: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  deleteButton: {
    color: Colors.accent,
  },
  emptySlot: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  micIconLarge: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptySlotText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  emptySlotSubtext: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
