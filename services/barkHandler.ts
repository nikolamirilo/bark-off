import { useAppStore } from '@/store/appStore';
import { BarkEvent, BarkLevel, DEFAULT_SETTINGS, Recording, Settings } from '@/types';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface BarkHandlerConfig {
    onBarkDetected: (event: BarkEvent) => void;
    onLevelChange: (level: BarkLevel | null, rms: number, dBFS: number) => void;
    onCooldownUpdate: (remainingSeconds: number) => void;
}

class BarkHandler {
    private recording: Audio.Recording | null = null;
    private isListening: boolean = false;
    private lastPlayTime: number = 0;
    private config: BarkHandlerConfig;
    private settings: Settings;
    private recordings: Recording[];
    private sounds: Map<number, Audio.Sound> = new Map();

    constructor(config: BarkHandlerConfig) {
        this.config = config;
        this.settings = useAppStore.getState().settings;
        this.recordings = useAppStore.getState().recordings;
    }

    async startListening(): Promise<void> {
        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                throw new Error('Microphone permission not granted');
            }

            // Set up audio session for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: true,
            });

            // Preload calming sounds
            await this.preloadSounds();

            // Start recording with metering enabled
            const { recording } = await Audio.Recording.createAsync(
                {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                    isMeteringEnabled: true,
                }
            );

            this.recording = recording;
            this.isListening = true;

            // Start monitoring via native callback
            this.recording.setOnRecordingStatusUpdate(this.handleRecordingStatusUpdate);
            await this.recording.setProgressUpdateInterval(100);
        } catch (error) {
            console.error('Error starting bark detection:', error);
            throw error;
        }
    }

    async stopListening(): Promise<void> {
        this.isListening = false;

        if (this.recording) {
            try {
                this.recording.setOnRecordingStatusUpdate(null);
                await this.recording.stopAndUnloadAsync();
            } catch (error) {
                console.error('Error stopping recording:', error);
            }
            this.recording = null;
        }

        // Unload sounds
        for (const sound of this.sounds.values()) {
            await sound.unloadAsync();
        }
        this.sounds.clear();
    }

    private async preloadSounds(): Promise<void> {
        // Refresh recordings from store
        this.recordings = useAppStore.getState().recordings;

        for (const recording of this.recordings) {
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: recording.uri });
                this.sounds.set(recording.level, sound);
            } catch (error) {
                console.error(`Error loading sound for level ${recording.level}:`, error);
            }
        }
    }

    private handleRecordingStatusUpdate = async (status: Audio.RecordingStatus) => {
        if (!this.isListening) return;

        try {
            if (!status.isRecording) return;

            // Get metering info (dB value)
            const metering = status.metering ?? -160;
            const dBFS = metering;

            // Check cooldown
            const now = Date.now();
            const cooldownRemaining = Math.max(
                0,
                this.settings.cooldownSeconds - (now - this.lastPlayTime) / 1000
            );

            this.config.onCooldownUpdate(cooldownRemaining);

            // Determine bark level using dBFS directly
            const level = this.determineLevel(dBFS);
            this.config.onLevelChange(level, dBFS, dBFS);

            // If bark detected and not in cooldown
            if (level !== null && cooldownRemaining <= 0) {
                const event: BarkEvent = {
                    id: generateId(),
                    timestamp: new Date(),
                    rms: 0,
                    dBFS,
                    level,
                    soundPlayed: false,
                };

                // Try to play calming sound
                const sound = this.sounds.get(level);
                if (sound) {
                    try {
                        await sound.replayAsync();
                        event.soundPlayed = true;
                        event.recordingId = this.recordings.find(r => r.level === level)?.id;
                        this.lastPlayTime = now;
                    } catch (error) {
                        console.error('Error playing calming sound:', error);
                    }
                }

                this.config.onBarkDetected(event);
            }
        } catch (error) {
            console.error('Error in monitoring callback:', error);
        }
    };

    private determineLevel(dBFS: number): BarkLevel | null {
        // Refresh settings
        this.settings = useAppStore.getState().settings;

        // Safety check
        let thresholdList = this.settings.thresholds;
        if (!Array.isArray(thresholdList)) {
            // Fallback if data is corrupted
            thresholdList = DEFAULT_SETTINGS.thresholds;
        }

        // Sort thresholds ascending by value (dBFS: -30 before -15)
        const thresholds = [...thresholdList].sort((a, b) => a.value - b.value);

        // Apply sensitivity as dB offset (sensitivity > 1 = more sensitive = lower threshold)
        const sensitivityOffset = (this.settings.sensitivity - 1.0) * 10; // ±10 dB range
        const adjustedDBFS = dBFS + sensitivityOffset;

        let highestLevelMatch: number | null = null;

        for (let i = 0; i < thresholds.length; i++) {
            if (adjustedDBFS > thresholds[i].value) {
                highestLevelMatch = i + 1; // 1-based level
            }
        }

        return highestLevelMatch;
    }

    updateSettings(settings: Settings): void {
        this.settings = settings;
    }

    async reloadSounds(): Promise<void> {
        // Unload existing sounds
        for (const sound of this.sounds.values()) {
            await sound.unloadAsync();
        }
        this.sounds.clear();

        // Reload from store
        await this.preloadSounds();
    }
}

// Singleton instance
let barkHandlerInstance: BarkHandler | null = null;

export const createBarkHandler = (config: BarkHandlerConfig): BarkHandler => {
    if (barkHandlerInstance) {
        barkHandlerInstance.stopListening();
    }
    barkHandlerInstance = new BarkHandler(config);
    return barkHandlerInstance;
};

export const getBarkHandler = (): BarkHandler | null => barkHandlerInstance;

export default BarkHandler;
