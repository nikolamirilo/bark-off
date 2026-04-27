//@ts-nocheck
import { SessionCompleteModal } from "@/components/listening/SessionCompleteModal";
import {
  BarkLevelIndicator,
  SoundWave,
} from "@/components/listening/SoundWave";
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
import { createBarkHandler } from "@/services/barkHandler";
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
import { customEvent } from "vexo-analytics";

export default function ListeningScreen() {
  const router = useRouter();
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
  const [currentRMS, setCurrentRMS] = useState(0);
  const [currentDBFS, setCurrentDBFS] = useState(-100);
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

  const handleLevelChange = useCallback(
    (level: BarkLevel | null, rms: number, dBFS: number) => {
      setCurrentLevel(level);
      setCurrentRMS(rms);
      setCurrentDBFS(dBFS);
    },
    [],
  );

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
          { text: "Go to Recordings", onPress: () => router.push("/explore") },
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

      const handler = createBarkHandler({
        onBarkDetected: handleBarkDetected,
        onLevelChange: handleLevelChange,
        onCooldownUpdate: handleCooldownUpdate,
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
      Alert.alert(
        "Ruh-roh! 🐶",
        "Could not start listening. Please check microphone permissions.",
        [{ text: "OK" }],
      );
      console.error("Error starting listening:", error);
    }
  };

  const handleStop = async (reason: "user_stop" | "app_background") => {
    // Prevent duplicate calls (e.g. from effect cleanup)
    if (!useAppStore.getState().isListening) return;

    const sessionBeforeStop = useAppStore.getState().currentSession;

    try {
      // Allow screen to sleep again
      await deactivateKeepAwake();

      const handler = createBarkHandler({
        onBarkDetected: () => {},
        onLevelChange: () => {},
        onCooldownUpdate: () => {},
      });
      await handler.stopListening();
    } catch (error) {
      console.error("Error stopping:", error);
    }

    setIsActive(false);
    endSession();

    // Generate report if we have a session
    // Generate report if we have a session
    const session = useAppStore.getState().currentSession;
    let reportId: string | undefined;

    if (session && session.events.length > 0) {
      const report = generateReport(session);
      addReport(report);
      reportId = report.id;
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
        soundsPlayed: sessionStats.soundsPlayed,
      },
      reportId,
    });
    setShowCompleteModal(true);

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
        contentContainerStyle={styles.content}
      >
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
              <Text style={styles.levelLabel}>Current Level</Text>
              <Text style={styles.levelValue}>
                {Math.max(1, Math.round(((currentDBFS + 60) / 50) * 100))}%
              </Text>
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
    paddingTop: Spacing.xl,
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
