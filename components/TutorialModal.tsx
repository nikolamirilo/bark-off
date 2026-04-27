import {
  BorderRadius,
  Colors,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import React, { useEffect, useState } from "react";
import {
  Image,
  ImageSourcePropType,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TUTORIAL_IMAGES: ImageSourcePropType[] = [
  require("../assets/images/tutorial/Tutorial 1.jpeg"),
  require("../assets/images/tutorial/Tutorial 2.png"),
  require("../assets/images/tutorial/Tutorial 3.png"),
  require("../assets/images/tutorial/Tutorial 4.png"),
];

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TutorialModal({ visible, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const insets = useSafeAreaInsets();

  // Reset to first step whenever the modal is reopened.
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  const isLast = step === TUTORIAL_IMAGES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleBack}
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={TUTORIAL_IMAGES[step]}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {TUTORIAL_IMAGES.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, idx === step && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.actionsRow}>
            {step > 0 ? (
              <TouchableOpacity
                onPress={handleBack}
                style={[styles.actionButton, styles.backButton]}
                activeOpacity={0.8}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton} />
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.actionButton, styles.nextButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? "Get Started" : "Next"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E1E2E",
    alignItems: "center",
    justifyContent: "space-between",
  },
  imageWrapper: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  footer: {
    width: "100%",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 20,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  backButtonText: {
    color: Colors.textLight,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  nextButton: {
    backgroundColor: Colors.primary,
  },
  nextButtonText: {
    color: Colors.textLight,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
});
