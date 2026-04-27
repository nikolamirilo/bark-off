import { Card } from "@/components/ui/Card";
import { Colors, FontSizes, FontWeights, Spacing } from "@/constants/Colors";
import { useReports } from "@/store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export function StatsRow() {
  const reports = useReports();

  const todaysReports = reports.filter((r) => {
    const today = new Date();
    const reportDate = new Date(r.generatedAt);
    return reportDate.toDateString() === today.toDateString();
  });
  const todaysBarks = todaysReports.reduce((sum, r) => sum + r.totalBarks, 0);

  return (
    <View style={styles.row}>
      <View style={styles.col}>
        <Card style={styles.card} variant="elevated">
          <LinearGradient
            colors={[Colors.backgroundLight, "#FFF5EB"]}
            style={styles.gradient}
          >
            <Image
              source={require("../../assets/images/woof.png")}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.value}>{todaysBarks}</Text>
            <Text style={styles.label}>Today's Woofs</Text>
          </LinearGradient>
        </Card>
      </View>
      <View style={styles.col}>
        <Card style={styles.card} variant="elevated">
          <LinearGradient
            colors={[Colors.backgroundLight, "#EBF9FF"]}
            style={styles.gradient}
          >
            <Image
              source={require("../../assets/images/session.png")}
              style={styles.icon}
              resizeMode="contain"
            />
            <Text style={styles.value}>{todaysReports.length}</Text>
            <Text style={styles.label}>Sessions</Text>
          </LinearGradient>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  col: { flex: 1 },
  card: {
    overflow: "hidden",
    borderWidth: 0,
    height: "auto",
    padding: 0,
    minHeight: 180,
  },
  gradient: {
    flex: 1,
    padding: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 10,
  },
  icon: {
    width: 100,
    height: 100,
    marginTop: Spacing.xs,
  },
  value: {
    fontSize: 36,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  label: {
    fontSize: FontSizes.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Colors.textSecondary,
    fontWeight: FontWeights.semibold,
    marginBottom: Spacing.lg,
  },
});
