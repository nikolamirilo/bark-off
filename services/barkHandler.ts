import { useAppStore } from '@/store/appStore';
import { BarkEvent, BarkLevel, DEFAULT_SETTINGS, Recording, Settings } from '@/types';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
    BarkDetector,
    DetectorFrame,
    FRAME_MS,
    normaliseExpoAvMetering,
} from './barkDetector';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const IS_ANDROID = Platform.OS === 'android';

/**
 * Detection-only recording options.
 *
 * The old code used HIGH_QUALITY (44.1 kHz stereo AAC @ 128 kbps), which wrote
 * ~1 MB per minute to disk — ~57 MB for a one-hour session — and never deleted
 * the file. None of that audio is ever played back: we only read the meter. Mono
 * at 22 kHz and a low bitrate is plenty, and the file is deleted on stop.
 */
const DETECTION_RECORDING_OPTIONS: Audio.RecordingOptions = {
    isMeteringEnabled: true,
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 32000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.LOW,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 32000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 32000,
    },
};

export interface BarkHandlerConfig {
    onBarkDetected: (event: BarkEvent) => void;
    /**
     * Per-frame state for the live UI. Replaces the old
     * `(level, rms, dBFS)` signature, whose `rms` argument was always fed dBFS.
     */
    onFrame: (frame: DetectorFrame) => void;
    onCooldownUpdate: (remainingSeconds: number) => void;
    /** Surfaced so a missing/corrupt clip is visible instead of console-only. */
    onSoundLoadError?: (level: BarkLevel, error: Error) => void;
}

/** Translate user settings into detector config. */
const detectorConfigFromSettings = (settings: Settings) => {
    const thresholds = Array.isArray(settings.thresholds)
        ? settings.thresholds
        : DEFAULT_SETTINGS.thresholds;

    return {
        // thresholds[].value now holds dB *above the room's noise floor*, not
        // absolute dBFS. See docs/SENSITIVITY_REVIEW.md.
        levelDeltasDb: thresholds.map((t) => t.value),
    };
};

class BarkHandler {
    private recording: Audio.Recording | null = null;
    private isListening: boolean = false;
    private lastPlayTime: number = 0;
    private config: BarkHandlerConfig;
    private settings: Settings;
    private recordings: Recording[];
    private sounds: Map<number, Audio.Sound> = new Map();
    private detector: BarkDetector;
    private unsubscribeSettings: (() => void) | null = null;
    /** Last recorder position, used to derive the real inter-frame interval. */
    private lastDurationMillis: number | null = null;

    constructor(config: BarkHandlerConfig) {
        this.config = config;
        this.settings = useAppStore.getState().settings;
        this.recordings = useAppStore.getState().recordings;
        this.detector = new BarkDetector(detectorConfigFromSettings(this.settings));
    }

    async startListening(): Promise<void> {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                throw new Error('Microphone permission not granted');
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: true,
            });

            await this.preloadSounds();

            this.detector.reset();
            this.detector.updateConfig(detectorConfigFromSettings(this.settings));
            this.lastDurationMillis = null;

            const { recording } = await Audio.Recording.createAsync(
                DETECTION_RECORDING_OPTIONS
            );

            this.recording = recording;
            this.isListening = true;

            // Subscribe once instead of reading the store on every frame (the old
            // code called getState() + copied + sorted the threshold array 10x/sec).
            this.unsubscribeSettings = useAppStore.subscribe((state) => {
                if (state.settings === this.settings) return;
                this.settings = state.settings;
                this.detector.updateConfig(detectorConfigFromSettings(state.settings));
            });

            this.recording.setOnRecordingStatusUpdate(this.handleRecordingStatusUpdate);
            await this.recording.setProgressUpdateInterval(FRAME_MS);
        } catch (error) {
            console.error('Error starting bark detection:', error);
            await this.stopListening();
            throw error;
        }
    }

    async stopListening(): Promise<void> {
        this.isListening = false;

        this.unsubscribeSettings?.();
        this.unsubscribeSettings = null;

        if (this.recording) {
            const uri = this.recording.getURI();
            try {
                this.recording.setOnRecordingStatusUpdate(null);
                await this.recording.stopAndUnloadAsync();
            } catch (error) {
                console.error('Error stopping recording:', error);
            }
            this.recording = null;

            // The detection recording is never played back — don't leave it behind.
            if (uri) {
                try {
                    await FileSystem.deleteAsync(uri, { idempotent: true });
                } catch (error) {
                    console.warn('Could not delete detection recording:', error);
                }
            }
        }

        for (const sound of this.sounds.values()) {
            try {
                await sound.unloadAsync();
            } catch (error) {
                console.warn('Error unloading sound:', error);
            }
        }
        this.sounds.clear();
        this.detector.reset();
    }

    private async preloadSounds(): Promise<void> {
        this.recordings = useAppStore.getState().recordings;

        for (const recording of this.recordings) {
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: recording.uri });
                this.sounds.set(recording.level, sound);
            } catch (error) {
                console.error(`Error loading sound for level ${recording.level}:`, error);
                this.config.onSoundLoadError?.(recording.level, error as Error);
            }
        }
    }

    /**
     * Deliberately synchronous. An `async` status callback can be re-entered while
     * suspended on `await sound.replayAsync()`, which let a later bark overtake an
     * earlier one (corrupting event order) and let `onBarkDetected` fire after
     * `stopListening()` had already generated the report. Playback is fired and
     * forgotten instead — nothing downstream needs to wait for it.
     */
    private handleRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        if (!this.isListening || !status.isRecording) return;

        try {
            // expo-av's Android metering is scaled by ln(10) because it uses
            // Math.log instead of log10 (AVManager.java:637). Normalise before
            // anything else so one dB scale is used throughout.
            const db = normaliseExpoAvMetering(status.metering ?? -160, IS_ANDROID);

            // Use the recorder's own clock rather than assuming we got the
            // FRAME_MS interval we asked for. Clamped so a stall or a
            // backgrounding gap can't be interpreted as one enormous frame.
            const deltaMs =
                this.lastDurationMillis === null
                    ? FRAME_MS
                    : Math.max(
                          10,
                          Math.min(500, status.durationMillis - this.lastDurationMillis)
                      );
            this.lastDurationMillis = status.durationMillis;

            const frame = this.detector.push(db, deltaMs);
            this.config.onFrame(frame);

            const now = Date.now();
            // Defended against a missing/NaN cooldown: the remaining-time
            // arithmetic would go NaN, and `NaN <= 0` is false, so playback would
            // be silently disabled for the whole session.
            const cooldownSeconds = Number.isFinite(this.settings.cooldownSeconds)
                ? this.settings.cooldownSeconds
                : DEFAULT_SETTINGS.cooldownSeconds;
            const cooldownRemaining = Math.max(
                0,
                cooldownSeconds - (now - this.lastPlayTime) / 1000
            );
            this.config.onCooldownUpdate(cooldownRemaining);

            if (!frame.bark) return;

            // Every confirmed bark is logged. Previously the cooldown gated both
            // playback *and* logging, so with a 15 s cooldown a dog barking for
            // two minutes recorded 8 events and every report stat undercounted.
            const event: BarkEvent = {
                id: generateId(),
                timestamp: new Date(),
                level: frame.bark.level,
                dBFS: frame.bark.peakDb,
                snrDb: frame.bark.peakSnrDb,
                noiseFloorDb: frame.bark.floorAtOnsetDb,
                durationMs: frame.bark.durationMs,
                soundPlayed: false,
            };

            // The cooldown only throttles playback, never logging.
            const level = frame.bark.level;
            const sound = this.sounds.get(level);
            const willPlay = cooldownRemaining <= 0 && sound !== undefined;

            if (willPlay) {
                // Claim the cooldown up front. Previously lastPlayTime was only set
                // on playback *success*, so a missing or broken clip meant the
                // cooldown never started and this fired every frame — 20/second.
                this.lastPlayTime = now;
                event.soundPlayed = true;
                event.recordingId = this.recordings.find(
                    (r) => r.level === level
                )?.id;

                sound!.replayAsync().catch((error) => {
                    console.error('Error playing calming sound:', error);
                });
            }

            this.config.onBarkDetected(event);
        } catch (error) {
            console.error('Error in monitoring callback:', error);
        }
    };

    /** Current adaptive noise floor, for diagnostics and the settings readout. */
    get noiseFloorDb(): number {
        return this.detector.currentNoiseFloorDb;
    }

    updateSettings(settings: Settings): void {
        this.settings = settings;
        this.detector.updateConfig(detectorConfigFromSettings(settings));
    }

    async reloadSounds(): Promise<void> {
        for (const sound of this.sounds.values()) {
            await sound.unloadAsync();
        }
        this.sounds.clear();
        await this.preloadSounds();
    }
}

// Singleton instance
let barkHandlerInstance: BarkHandler | null = null;

/**
 * Replace the active handler. Awaits teardown of the previous one — the old
 * version fired `stopListening()` without awaiting it and immediately returned a
 * new instance, so the real teardown raced with the new recorder.
 */
export const createBarkHandler = async (
    config: BarkHandlerConfig
): Promise<BarkHandler> => {
    if (barkHandlerInstance) {
        await barkHandlerInstance.stopListening();
    }
    barkHandlerInstance = new BarkHandler(config);
    return barkHandlerInstance;
};

export const getBarkHandler = (): BarkHandler | null => barkHandlerInstance;

/** Stop and discard the active handler, if any. */
export const destroyBarkHandler = async (): Promise<void> => {
    if (!barkHandlerInstance) return;
    await barkHandlerInstance.stopListening();
    barkHandlerInstance = null;
};

export default BarkHandler;
