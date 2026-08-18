import { SessionCompleteModal } from "@/components/listening/SessionCompleteModal";
import { describeNoiseFloor } from "@/components/settings/utils";
import {
  BarkLevelIndicator,
  SoundWave,
} from "@/components/listening/SoundWave";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  BorderRadius,
  Colors,
  DogText,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/Colors";
import { DetectorFrame } from "@/services/barkDetector";
import { createBarkHandler, destroyBarkHandler } from "@/services/barkHandler";
import { generateReport } from "@/services/reportService";
import { useAppStore } from "@/store/appStore";
import { BarkEvent, BarkLevel } from "@/types";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customEvent } from "vexo-analytics";

export default function ListeningScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    currentSession,
    startSession,
    endSession,
    addBarkEvent,
    addReport,
    settings,
    dogProfile,
    recordings,
  } = useAppStore();

  const [isActive, setIsActive] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<BarkLevel | null>(null);
  /** 0-100: how close the room currently is to triggering a bark. */
  const [triggerProgress, setTriggerProgress] = useState(0);
  const [noiseFloorDb, setNoiseFloorDb] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    barkCount: 0,
    soundsPlayed: 0,
  });
  const [showTips, setShowTips] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedSessionData, setCompletedSessionData] = useState<{
    stats: { barkCount: number; duration: string; soundsPlayed: number };
    reportId?: string;
  } | null>(null);

  const handleBarkDetected = useCallback(
    (event: BarkEvent) => {
      addBarkEvent(event);
      setSessionStats((prev) => ({
        barkCount: prev.barkCount + 1,
        soundsPlayed: event.soundPlayed
          ? prev.soundsPlayed + 1
          : prev.soundsPlayed,
      }));
    },
    [addBarkEvent],
  );

  const handleFrame = useCallback((frame: DetectorFrame) => {
    setCurrentLevel(frame.level);
    setTriggerProgress(frame.triggerProgress);
    setNoiseFloorDb(frame.noiseFloorDb);
  }, []);

  const handleCooldownUpdate = useCallback((remaining: number) => {
    setCooldownRemaining(remaining);
  }, []);

  const handleStartWithTips = () => {
    setShowTips(true);
  };

  const getElapsedMs = (startedAt?: Date, endedAt?: Date) => {
    if (!startedAt) return 0;
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    return Math.max(0, end - start);
  };

  const handleStart = async () => {
    // Validate that we have recordings for all defined levels
    const requiredLevels = Array.from(
      { length: settings.thresholds.length },
      (_, i) => i + 1,
    );
    const missingLevels = requiredLevels.filter(
      (level) => !recordings.some((r) => r.level === level),
    );

    if (missingLevels.length > 0) {
      Alert.alert(
        "Missing Sounds 🎵",
        `Please record sounds for the following levels before starting: ${missingLevels.join(", ")}`,
        [
          { text: "Go to Recordings", onPress: () => router.push("/settings") },
          { text: "Cancel", style: "cancel" },
        ],
      );
      setShowTips(false);
      return;
    }

    setShowTips(false);

    try {
      // Keep screen on while listening
      await activateKeepAwakeAsync();

      const handler = await createBarkHandler({
        onBarkDetected: handleBarkDetected,
        onFrame: handleFrame,
        onCooldownUpdate: handleCooldownUpdate,
        onSoundLoadError: (level) => {
          Alert.alert(
            "Sound missing 🎵",
            `The clip for level ${level} could not be loaded. Re-record it in Settings.`,
          );
        },
      });

      await handler.startListening();
      startSession();
      setIsActive(true);
      setSessionStats({ barkCount: 0, soundsPlayed: 0 });

      const startedSession = useAppStore.getState().currentSession;
      customEvent("session-start", {
        screen: "listening",
        source: "button",
        session_id: startedSession?.id,
      });
    } catch (error) {
      // handleStop early-returns when isListening is false, so it can't undo this.
      await deactivateKeepAwake().catch(() => {});
      await destroyBarkHandler().catch(() => {});
      Alert.alert(
        "Ruh-roh! 🐶",
        "Could not start listening. Please check microphone permissions.",
        [{ text: "OK" }],
      );
      console.error("Error starting listening:", error);
    }
  };

  const handleStop = async (
    reason: "user_stop" | "app_background" | "user_leave",
  ) => {
    // Prevent duplicate calls (e.g. from effect cleanup)
    if (!useAppStore.getState().isListening) return;

    const sessionBeforeStop = useAppStore.getState().currentSession;

    try {
      // Allow screen to sleep again
      await deactivateKeepAwake();

      // Tear down the *existing* handler. The old code built a throwaway handler
      // here, which fired the real teardown without awaiting it and then awaited
      // a brand new empty instance instead.
      await destroyBarkHandler();
    } catch (error) {
      console.error("Error stopping:", error);
    }

    setIsActive(false);
    setCurrentLevel(null);
    setTriggerProgress(0);
    setNoiseFloorDb(null);
    endSession();

    const session = useAppStore.getState().currentSession;
    let reportId: string | undefined;

    // Guarded: a throw in here used to skip the completion modal entirely and
    // surface as an unhandled rejection, losing the session with no feedback.
    if (session && session.events.length > 0) {
      try {
        const report = generateReport(session);
        addReport(report);
        reportId = report.id;
      } catch (error) {
        console.error("Error generating report:", error);
      }
    }

    // Calculate duration string for the modal
    let finalDuration = "0:00";
    if (session && session.startedAt) {
      const startTime = new Date(session.startedAt).getTime();
      const now = session.endedAt
        ? new Date(session.endedAt).getTime()
        : Date.now();
      const seconds = Math.floor((now - startTime) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      finalDuration = `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    setCompletedSessionData({
      stats: {
        barkCount: session ? session.events.length : 0,
        duration: finalDuration,
        // Counted from the session itself rather than from `sessionStats`, which
        // this function closes over: when called from the unmount effect the
        // closure is the one captured when the session started, so the modal
        // always reported zero sounds played.
        soundsPlayed: session
          ? session.events.filter((e) => e.soundPlayed).length
          : 0,
      },
      reportId,
    });
    // Suppressed when the user is navigating away: this screen is a tab and
    // stays mounted, so the modal would otherwise surface over the Home screen.
    if (reason !== "user_leave") {
      setShowCompleteModal(true);
    }

    customEvent("session-end", {
      screen: "listening",
      session_id: sessionBeforeStop?.id,
      reason,
      elapsed_ms: getElapsedMs(sessionBeforeStop?.startedAt, new Date()),
      bark_count: sessionBeforeStop?.events?.length ?? 0,
    });
  };

  const handleStopFromUser = async () => {
    const session = useAppStore.getState().currentSession;
    customEvent("stop-session-pressed", {
      screen: "listening",
      session_id: session?.id,
      reason: "user_stop",
      elapsed_ms: getElapsedMs(session?.startedAt, new Date()),
    });
    await handleStop("user_stop");
  };

  const handleBackPress = (goBack: () => void) => {
    if (!isActive) {
      goBack();
      return;
    }
    Alert.alert(
      "Session in progress 🎧",
      `${dogProfile.name || "Your pup"} is still being listened to. Stop the session and go back?`,
      [
        { text: "Keep Listening", style: "cancel" },
        {
          text: "Stop & Leave",
          style: "destructive",
          onPress: async () => {
            await handleStop("user_leave");
            goBack();
          },
        },
      ],
    );
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActive) {
        handleStop("app_background");
      }
    };
  }, [isActive]);

  const formatDuration = () => {
    if (!currentSession?.startedAt) return "0:00";
    const startTime = new Date(currentSession.startedAt).getTime();
    const now = Date.now();
    const seconds = Math.floor((now - startTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Update duration display
  const [duration, setDuration] = useState("0:00");
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setDuration(formatDuration());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, currentSession]);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.sm },
        ]}
      >
        <BackButton onPress={handleBackPress} style={styles.backButton} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isActive ? DogText.listeningTitle : DogText.homeTitle}
          </Text>
          <Text style={styles.subtitle}>Listening to {dogProfile.name}</Text>
        </View>

        {/* Sound Wave Visualization */}
        <Card variant="elevated" style={styles.visualizerCard}>
          <SoundWave isActive={isActive} level={currentLevel} />

          {isActive && (
            <View style={styles.currentLevel}>
              {/* Shows how close the room is to triggering, not an absolute dB
                  percentage — the old readout could sit at 60% in a silent room
                  and told the user nothing about whether a bark was imminent. */}
              <Text style={styles.levelLabel}>Loudness vs. trigger</Text>
              <Text style={styles.levelValue}>{triggerProgress}%</Text>
              {noiseFloorDb !== null && (
                <Text style={styles.roomLabel}>
                  Room: {describeNoiseFloor(noiseFloorDb)}
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Bark Level Indicator */}
        <Card emoji="🦴" title="BARK-O-METER" style={styles.meterCard}>
          <BarkLevelIndicator currentLevel={currentLevel} animated={isActive} />
        </Card>

        {/* Cooldown Timer */}
        {isActive && cooldownRemaining > 0 && (
          <Card style={styles.cooldownCard}>
            <View style={styles.cooldownContent}>
              <Text style={styles.cooldownEmoji}>⏱️</Text>
              <View>
                <Text style={styles.cooldownLabel}>Cooldown Active</Text>
                <Text style={styles.cooldownValue}>
                  {cooldownRemaining.toFixed(1)}s remaining
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Session Stats */}
        {isActive && (
          <Card emoji="📊" title="This Session" style={styles.statsCard}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{duration}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sessionStats.barkCount}</Text>
                <Text style={styles.statLabel}>Woofs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {sessionStats.soundsPlayed}
                </Text>
                <Text style={styles.statLabel}>Sounds</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Action Button */}
        <View style={styles.actionContainer}>
          {isActive ? (
            <Button
              title={DogText.stopListening}
              onPress={handleStopFromUser}
              variant="danger"
              size="large"
              style={styles.actionButton}
            />
          ) : (
            <Button
              title={DogText.startListening}
              onPress={handleStartWithTips}
              variant="primary"
              size="large"
              style={styles.actionButton}
            />
          )}
        </View>

        {/* Instructions */}
        {!isActive && (
          <Card style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How it works 🐾</Text>
            <Text style={styles.instructionsText}>
              1. Tap &quot;Start&quot; to begin listening{"\n"}
              2. BarkOff will detect when your pet barks{"\n"}
              3. Calming sounds play automatically{"\n"}
              4. View detailed reports after each session
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Tips Modal */}
      <Modal
        visible={showTips}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTips(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Before You Start 🐾</Text>

            <View style={styles.tipItem}>
              <Text style={styles.tipItemIcon}>🔊</Text>
              <Text style={styles.tipItemText}>
                Make sure your phone&apos;s sound is turned on and volume is up
              </Text>
            </View>

            <View style={styles.tipItem}>
              <Text style={styles.tipItemIcon}>🔒</Text>
              <Text style={styles.tipItemText}>
                Adjust your settings so your phone does not automatically lock
              </Text>
            </View>

            <View style={styles.tipItem}>
              <Text style={styles.tipItemIcon}>📱</Text>
              <Text style={styles.tipItemText}>
                Place your phone somewhere it will always be near your dog and
                let them enjoy time with their new digital friend
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleStart}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.primaryLight, Colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalButtonGradient}
              >
                <Text style={styles.modalButtonText}>Start Listening 🎧</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTips(false)}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Session Complete Modal */}
      {completedSessionData && (
        <SessionCompleteModal
          visible={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          onViewReport={() => {
            setShowCompleteModal(false);
            if (completedSessionData.reportId) {
              router.push(`/session-report/${completedSessionData.reportId}`);
            }
          }}
          stats={completedSessionData.stats}
          reportId={completedSessionData.reportId}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  content: {
    padding: Spacing.lg,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  visualizerCard: {
    marginBottom: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  currentLevel: {
    marginTop: Spacing.md,
    alignItems: "center",
  },
  levelLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  levelValue: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  roomLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  meterCard: {
    marginBottom: Spacing.md,
  },
  cooldownCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.warning + "20",
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  cooldownContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cooldownEmoji: {
    fontSize: 32,
  },
  cooldownLabel: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.textPrimary,
  },
  cooldownValue: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statsCard: {
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionContainer: {
    marginBottom: Spacing.lg,
  },
  actionButton: {
    width: "100%",
  },
  instructionsCard: {
    backgroundColor: Colors.secondary + "15",
  },
  instructionsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  instructionsText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.textPrimary,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.primary + "08",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  tipItemIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  tipItemText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontWeight: FontWeights.medium,
  },
  modalButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  modalButtonGradient: {
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.lg,
  },
  modalButtonText: {
    color: "#FFF",
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  modalCancelButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },
});
