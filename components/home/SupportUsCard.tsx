import { Card } from "@/components/ui/Card";
import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React from "react";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { customEvent } from "vexo-analytics";

const BUY_ME_A_COFFEE_URL = "https://www.buymeacoffee.com/reactify.solutions";

export function SupportUsCard() {
  return (
    <Card emoji="☕" title="Support Us" style={styles.card}>
      <Text style={styles.description}>
        Love BarkOff? Help us improve the app and keep building new features
        for your furry friend!
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          customEvent("buy-coffee-clicked", {
            screen: "home",
            placement: "card",
          });
          Linking.openURL(BUY_ME_A_COFFEE_URL);
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.emoji}>☕</Text>
        <Text style={styles.buttonText}>Buy Us a Coffee</Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.md },
  description: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFDD00",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emoji: { fontSize: FontSizes.xl },
  buttonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: "#000000",
  },
});
