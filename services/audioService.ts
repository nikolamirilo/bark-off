import { BarkLevel, Recording } from '@/types';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

// Ensure recordings directory exists
export const ensureRecordingsDir = async (): Promise<void> => {
    const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
    }
};

// Audio recording service
class AudioService {
    private recording: Audio.Recording | null = null;
    private sound: Audio.Sound | null = null;

    async startRecording(): Promise<void> {
        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            if (!permission.granted) {
                throw new Error('Microphone permission not granted');
            }

            // Set up audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                shouldDuckAndroid: true,
            });

            // Start recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            this.recording = recording;
        } catch (error) {
            console.error('Error starting recording:', error);
            throw error;
        }
    }

    async stopRecording(): Promise<{ uri: string; duration: number } | null> {
        if (!this.recording) return null;

        try {
            await this.recording.stopAndUnloadAsync();
            const status = await this.recording.getStatusAsync();
            const uri = this.recording.getURI();

            const result = uri ? {
                uri,
                duration: (status.durationMillis ?? 0) / 1000,
            } : null;

            this.recording = null;
            return result;
        } catch (error) {
            console.error('Error stopping recording:', error);
            this.recording = null;
            throw error;
        }
    }

    async cancelRecording(): Promise<void> {
        if (!this.recording) return;

        try {
            await this.recording.stopAndUnloadAsync();
            this.recording = null;
        } catch (error) {
            console.error('Error canceling recording:', error);
            this.recording = null;
        }
    }

    async saveRecording(
        tempUri: string,
        name: string,
        level: BarkLevel
    ): Promise<Recording> {
        await ensureRecordingsDir();

        const id = generateId();
        const filename = `recording_${id}.m4a`;
        const permanentUri = `${RECORDINGS_DIR}${filename}`;

        // Move from temp to permanent location
        await FileSystem.moveAsync({
            from: tempUri,
            to: permanentUri,
        });

        // Get duration
        const { sound } = await Audio.Sound.createAsync({ uri: permanentUri });
        const status = await sound.getStatusAsync();
        const duration = status.isLoaded ? (status.durationMillis ?? 0) / 1000 : 0;
        await sound.unloadAsync();

        const recording: Recording = {
            id,
            name,
            uri: permanentUri,
            duration,
            level,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        return recording;
    }

    async deleteRecording(uri: string): Promise<void> {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (fileInfo.exists) {
                await FileSystem.deleteAsync(uri);
            }
        } catch (error) {
            console.error('Error deleting recording:', error);
        }
    }

    async playSound(uri: string): Promise<void> {
        try {
            // Unload previous sound if any
            if (this.sound) {
                await this.sound.unloadAsync();
                this.sound = null;
            }

            // Set audio mode for playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });

            // Load and play
            const { sound } = await Audio.Sound.createAsync({ uri });
            this.sound = sound;
            await sound.playAsync();

            // Clean up when done
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    this.sound = null;
                }
            });
        } catch (error) {
            console.error('Error playing sound:', error);
            throw error;
        }
    }

    async stopSound(): Promise<void> {
        if (this.sound) {
            try {
                await this.sound.stopAsync();
                await this.sound.unloadAsync();
                this.sound = null;
            } catch (error) {
                console.error('Error stopping sound:', error);
            }
        }
    }
}

// Singleton instance
export const audioService = new AudioService();
export default audioService;
