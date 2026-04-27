import { Card } from "@/components/ui/Card";
import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { useAppStore, useRecordings, useSettings } from "@/store/appStore";
import React, { useEffect } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const BASE_OPTIONS = [5, 10, 15, 20, 30];

export function CooldownCard() {
  const settings = useSettings();
  const recordings = useRecordings();
  const updateSettings = useAppStore((s) => s.updateSettings);

  // Enforce that cooldown stays strictly longer than the longest recording.
  useEffect(() => {
    if (recordings.length === 0) return;
    const maxDuration = Math.max(...recordings.map((r) => r.duration));
    let target = BASE_OPTIONS.find((opt) => opt > maxDuration);
    if (!target) target = Math.ceil((maxDuration + 1) / 5) * 5;

    if (settings.cooldownSeconds <= maxDuration) {
      updateSettings({ cooldownSeconds: target });
      Alert.alert(
        "Cooldown Updated ⏱️",
        `Cooldown increased to ${target}s. It must be longer than your longest recording (${Math.ceil(
          maxDuration,
        )}s).`,
      );
    }
  }, [recordings, settings.cooldownSeconds, updateSettings]);

  const maxDuration =
    recordings.length > 0 ? Math.max(...recordings.map((r) => r.duration)) : 0;
  const minRequired = Math.ceil(maxDuration + 2);

  const displayOptions = [...BASE_OPTIONS];
  if (minRequired > 30) {
    const nextValid = Math.ceil(minRequired / 5) * 5;
    if (!displayOptions.includes(nextValid)) displayOptions.push(nextValid);
  }
  displayOptions.sort((a, b) => a - b);

  const handleSelect = (seconds: number) => {
    updateSettings({ cooldownSeconds: seconds });
  };

  return (
    <Card emoji="⏱️" title="Cooldown" style={styles.card}>
      <Text style={styles.description}>
        Time between calming sounds. Minimum is set by your longest recording.
      </Text>
      <View style={styles.options}>
        {displayOptions.map((option) => {
          const isDisabled = option < minRequired;
          const isSelected = settings.cooldownSeconds === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                isSelected && styles.optionSelected,
                isDisabled && styles.optionDisabled,
              ]}
              onPress={() => !isDisabled && handleSelect(option)}
              disabled={isDisabled}
            >
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                  isDisabled && styles.optionTextDisabled,
                ]}
              >
                {option}s
              </Text>
              {isDisabled && <Text style={styles.lockIcon}>🔒</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  description: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 18,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  option: {
    flexGrow: 1,
    flexBasis: "30%",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardLight,
    flexDirection: "row",
    gap: 4,
  },
  optionSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + "15",
    borderWidth: 2,
  },
  optionDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.backgroundLight,
    borderColor: Colors.border,
  },
  optionText: {
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeights.medium,
  },
  optionTextSelected: {
    color: Colors.secondary,
    fontWeight: FontWeights.bold,
  },
  optionTextDisabled: {
    color: Colors.textMuted,
  },
  lockIcon: { fontSize: FontSizes.xs },
});
