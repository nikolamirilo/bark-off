import { BarkLevelsAndMessagesCard } from "@/components/settings/BarkLevelsAndMessagesCard";
import { CooldownCard } from "@/components/settings/CooldownCard";
import { PetProfileCard } from "@/components/settings/PetProfileCard";
import { TutorialButton } from "@/components/settings/TutorialButton";
import { TutorialModal } from "@/components/TutorialModal";
import {
  Colors,
  DogText,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  const [tutorialVisible, setTutorialVisible] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{DogText.settingsTitle}</Text>
        <Text style={styles.subtitle}>Customize your pet&apos;s experience!</Text>
      </View>

      <PetProfileCard />

      <TutorialButton onPress={() => setTutorialVisible(true)} />

      <BarkLevelsAndMessagesCard />

      <CooldownCard />

      <TutorialModal
        visible={tutorialVisible}
        onClose={() => setTutorialVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
});
