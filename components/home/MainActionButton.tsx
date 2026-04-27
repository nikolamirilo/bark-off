import { PawIcon } from "@/components/ui/PawIcon";
import {
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { useIsListening } from "@/store/appStore";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface MainActionButtonProps {
  onPress: () => void;
}

export function MainActionButton({ onPress }: MainActionButtonProps) {
  const isListening = useIsListening();
  const buttonScale = useSharedValue(1);
  const pawRotation = useSharedValue(0);

  useEffect(() => {
    if (!isListening) {
      // Heartbeat + gentle sway when idle.
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000 }),
          withTiming(1.0, { duration: 1000 }),
        ),
        -1,
        true,
      );
      pawRotation.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 2500 }),
          withTiming(-5, { duration: 2500 }),
        ),
        -1,
        true,
      );
    } else {
      // Alert pulse while listening.
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800 }),
          withTiming(1.0, { duration: 800 }),
        ),
        -1,
        true,
      );
      pawRotation.value = withTiming(0);
    }
  }, [isListening]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: buttonScale.value },
      { rotate: `${pawRotation.value}deg` },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.wrapper, animatedStyle]}>
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.9}
          style={styles.touchable}
        >
          <LinearGradient
            colors={
              isListening
                ? [Colors.levelHigh, Colors.accent]
                : [Colors.primaryLight, Colors.primary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.pawContainer}>
              <PawIcon size={120} color="#FFF" />
            </View>
            <View style={styles.labelContainer}>
              <Text style={styles.label}>GO!</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.statusText}>
        {isListening
          ? "Keep quiet, I'm listening for woofs..."
          : "Tap the paw to start monitoring"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  wrapper: {
    borderRadius: 125,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  touchable: { width: 250, height: 250, borderRadius: 125 },
  gradient: {
    width: "100%",
    height: "100%",
    borderRadius: 125,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.3)",
  },
  pawContainer: {
    marginBottom: Spacing.xs,
    transform: [{ translateY: 10 }],
  },
  labelContainer: {
    alignItems: "center",
    position: "relative",
    top: 15,
  },
  label: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: "#FFF",
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusText: {
    marginTop: Spacing.lg,
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: "center",
    fontWeight: FontWeights.medium,
  },
});
