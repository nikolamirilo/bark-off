import { ContactUsCard } from "@/components/home/ContactUsCard";
import { DailyTipCard } from "@/components/home/DailyTipCard";
import { HomeHeader } from "@/components/home/HomeHeader";
import { MainActionButton } from "@/components/home/MainActionButton";
import { RecentActivityCard } from "@/components/home/RecentActivityCard";
import { StatsRow } from "@/components/home/StatsRow";
import { SupportUsCard } from "@/components/home/SupportUsCard";
import { Colors, Spacing } from "@/constants/Colors";
import { useRecordings, useSettings } from "@/store/appStore";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { customEvent } from "vexo-analytics";

export default function HomeScreen() {
  const router = useRouter();
  const recordings = useRecordings();
  const settings = useSettings();

  const handleStartListening = () => {
    // Require a recording for each configured bark level before listening.
    const requiredLevels = Array.from(
      { length: settings.thresholds.length },
      (_, i) => i + 1,
    );
    const missingLevels = requiredLevels.filter(
      (level) => !recordings.some((r) => r.level === level),
    );

    customEvent("go-pressed", {
      screen: "home",
      has_recordings_ready: missingLevels.length === 0,
      missing_levels_count: missingLevels.length,
    });

    if (missingLevels.length > 0) {
      Alert.alert(
        "Setup Required 🎵",
        "Please record calming sounds for your pet before starting. Tap OK to go to Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "OK", onPress: () => router.push("/settings") },
        ],
      );
      return;
    }

    router.push("/listening");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader onProfilePress={() => router.push("/settings")} />

        <MainActionButton onPress={handleStartListening} />

        <StatsRow />

        <RecentActivityCard onPress={() => router.push("/reports")} />

        <SupportUsCard />

        <DailyTipCard />

        <ContactUsCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl + 20,
  },
});
