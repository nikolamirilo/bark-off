import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function DailyTipCard() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.primary + "15", Colors.primary + "05"]}
        style={styles.tip}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>💡</Text>
          <Text style={styles.title}>Paw-some Tip</Text>
        </View>
        <Text style={styles.text}>
          Dogs respond best to their human's voice. Try recording a calming
          message in Settings! 🎙️
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  tip: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primary + "20",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  icon: { fontSize: 20 },
  title: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.primaryDark,
  },
  text: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
