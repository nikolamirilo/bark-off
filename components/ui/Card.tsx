import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

interface CardProps {
  children: React.ReactNode;
  title?: string;
  emoji?: string;
  variant?: "default" | "elevated" | "outlined";
  style?: ViewStyle;
}

export function Card({
  children,
  title,
  emoji,
  variant = "default",
  style,
}: CardProps) {
  const getCardStyle = (): ViewStyle => {
    switch (variant) {
      case "elevated":
        return styles.elevated;
      case "outlined":
        return styles.outlined;
      default:
        return styles.default;
    }
  };

  return (
    <View style={[styles.card, getCardStyle(), style]}>
      {(title || emoji) && (
        <View style={styles.header}>
          {emoji && <Text style={styles.emoji}>{emoji}</Text>}
          {title && <Text style={styles.title}>{title}</Text>}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  default: {
    backgroundColor: Colors.cardLight,
  },
  elevated: {
    backgroundColor: Colors.cardLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  outlined: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emoji: {
    fontSize: FontSizes.xl,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
});
