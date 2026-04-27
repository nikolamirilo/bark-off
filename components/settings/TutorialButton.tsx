import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface TutorialButtonProps {
  onPress: () => void;
}

export function TutorialButton({ onPress }: TutorialButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.button}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>📖</Text>
      <Text style={styles.text}>Show Tutorial</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  icon: { fontSize: FontSizes.md },
  text: {
    fontSize: FontSizes.md,
    color: Colors.textLight,
    fontWeight: FontWeights.semibold,
  },
});
