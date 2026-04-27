import { TutorialModal } from "@/components/TutorialModal";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppStore } from "@/store/appStore";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { vexo } from "vexo-analytics";

const BarkOffLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.backgroundLight,
    card: Colors.cardLight,
    text: Colors.textPrimary,
    border: Colors.border,
  },
};

const BarkOffDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.backgroundDark,
    card: Colors.cardDark,
    text: Colors.textLight,
    border: Colors.borderDark,
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

vexo("acf40163-1aff-4be9-bcb5-d42dc2b4ea10");

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [tutorialVisible, setTutorialVisible] = useState(false);

  // ONE-SHOT CLEANUP: purges the seeded timeline-chart test reports that were
  // persisted by a previous build. Safe to remove entirely after the app has
  // launched once with this code in place.
  useEffect(() => {
    const purgeTestReports = () => {
      const current = useAppStore.getState().reports;
      const cleaned = current.filter((r) => !r.id.endsWith("-TEMP"));
      if (cleaned.length !== current.length) {
        useAppStore.setState({ reports: cleaned });
      }
    };
    if (useAppStore.persist.hasHydrated()) {
      purgeTestReports();
      return;
    }
    return useAppStore.persist.onFinishHydration(purgeTestReports);
  }, []);

  // Show the tutorial once on first app launch after install. Must wait for
  // the persisted store to hydrate before reading hasSeenTutorial.
  useEffect(() => {
    const maybeShowTutorial = () => {
      if (!useAppStore.getState().hasSeenTutorial) {
        setTutorialVisible(true);
      }
    };
    if (useAppStore.persist.hasHydrated()) {
      maybeShowTutorial();
      return;
    }
    return useAppStore.persist.onFinishHydration(maybeShowTutorial);
  }, []);

  const handleTutorialClose = () => {
    useAppStore.getState().setHasSeenTutorial(true);
    setTutorialVisible(false);
    router.navigate("/(tabs)/settings");
  };

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? BarkOffDarkTheme : BarkOffLightTheme}
    >
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="session-report/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
      <TutorialModal visible={tutorialVisible} onClose={handleTutorialClose} />
    </ThemeProvider>
  );
}
