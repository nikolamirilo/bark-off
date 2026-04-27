import { Card } from "@/components/ui/Card";
import {
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { useReports } from "@/store/appStore";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

interface RecentActivityCardProps {
  onPress: () => void;
}

export function RecentActivityCard({ onPress }: RecentActivityCardProps) {
  const reports = useReports();
  const hasReports = reports.length > 0;
  const lastBarkTime = hasReports
    ? getRelativeTime(new Date(reports[0].generatedAt))
    : "No sessions yet";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
        {hasReports && (
          <TouchableOpacity onPress={onPress}>
            <Text style={styles.seeAllLink}>See All</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={onPress} style={{ width: "100%" }}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.row}>
            <View
              style={[
                styles.icon,
                {
                  backgroundColor: hasReports
                    ? Colors.success + "20"
                    : Colors.textMuted + "20",
                },
              ]}
            >
              <Text style={{ fontSize: 20 }}>{hasReports ? "📊" : "💤"}</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.mainText}>
                {hasReports
                  ? "Recent Bark-tivities"
                  : "No bark-tivities recorded"}
              </Text>
              <Text style={styles.subText}>
                {hasReports ? lastBarkTime : "Start listening to track barks!"}
              </Text>
            </View>
            {hasReports && <Text style={styles.arrow}>›</Text>}
          </View>
        </Card>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  seeAllLink: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  card: { padding: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1 },
  mainText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  subText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  arrow: { fontSize: 24, color: Colors.borderDark, opacity: 0.5 },
});
