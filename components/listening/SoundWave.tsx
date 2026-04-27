import { Colors, DogText, Spacing } from '@/constants/Colors';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_SETTINGS } from '@/types';

// Display names always come from DogText so relabeling is centralized.
const getBarkLevelLabel = (index: number): string => {
    if (index === 0) return DogText.levelsoftBark;
    if (index === 1) return DogText.levelLoudBark;
    return `Level ${index + 1}`;
};
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface SoundWaveProps {
    isActive: boolean;
    level: number | null; // 1-based index
    color?: string;
}

const BAR_COUNT = 7;

export function SoundWave({ isActive, level, color }: SoundWaveProps) {
    const barHeights = Array(BAR_COUNT).fill(0).map(() => useSharedValue(20));

    // Helper to get color for a level index (cycling through pre-defined or generating)
    const getLevelColor = (lvl: number) => {
        const colors = [Colors.levelLow, Colors.levelMedium, Colors.levelHigh, Colors.accent, Colors.secondary];
        return colors[(lvl - 1) % colors.length];
    };

    useEffect(() => {
        if (isActive) {
            barHeights.forEach((height, index) => {
                const delay = index * 100;
                const baseHeight = 20;
                // Scale height based on level intensity
                const intensity = level ? level : 0;
                const maxHeight = 40 + intensity * 10;

                height.value = withRepeat(
                    withSequence(
                        withTiming(maxHeight, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) }),
                        withTiming(baseHeight, { duration: 400 + delay, easing: Easing.inOut(Easing.ease) })
                    ),
                    -1,
                    true
                );
            });
        } else {
            barHeights.forEach((height) => {
                height.value = withSpring(20);
            });
        }
    }, [isActive, level]);

    const getBarColor = () => {
        if (!isActive) return Colors.textMuted;
        if (level === null) return color || Colors.secondary;
        return getLevelColor(level);
    };

    return (
        <View style={styles.container}>
            {barHeights.map((height, index) => {
                const animatedStyle = useAnimatedStyle(() => ({
                    height: height.value,
                }));

                return (
                    <Animated.View
                        key={index}
                        style={[
                            styles.bar,
                            { backgroundColor: getBarColor() },
                            animatedStyle,
                        ]}
                    />
                );
            })}
        </View>
    );
}

interface BarkLevelIndicatorProps {
    currentLevel: number | null;
    animated?: boolean;
}

export function BarkLevelIndicator({ currentLevel, animated = true }: BarkLevelIndicatorProps) {
    const { settings } = useAppStore();
    const thresholds = Array.isArray(settings.thresholds) ? settings.thresholds : DEFAULT_SETTINGS.thresholds;

    // Use a map to track animations for each level. 
    // Since hooks can't be dynamic in loop, we might need a fixed max or a different approach.
    // Given the constraints of React Hooks + dynamic array, we can't create `useSharedValue` in a loop cleanly.
    // Solution: Render a list of components, each with its own hook.

    return (
        <View style={styles.boneContainer}>
            {thresholds.map((threshold, index) => (
                <LevelBone
                    key={threshold.id}
                    level={index + 1}
                    name={getBarkLevelLabel(index)}
                    active={currentLevel !== null && currentLevel >= index + 1}
                    animated={animated}
                />
            ))}
        </View>
    );
}

// Sub-component to safely use hooks per item
function LevelBone({ level, name, active, animated }: { level: number, name: string, active: boolean, animated: boolean }) {
    const scale = useSharedValue(1);

    const getBoneColor = (lvl: number) => {
        const colors = [Colors.levelLow, Colors.levelMedium, Colors.levelHigh, Colors.accent, Colors.secondary];
        return colors[(lvl - 1) % colors.length];
    };

    const color = active ? getBoneColor(level) : Colors.textMuted;

    useEffect(() => {
        if (active && animated) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 300 }),
                    withTiming(1, { duration: 300 })
                ),
                -1,
                true
            );
        } else {
            scale.value = withSpring(1);
        }
    }, [active, animated]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    // Generate short label
    const label = level === 1 ? 'Low' : 'High';

    return (
        <Animated.View style={[styles.boneWrapper, animatedStyle]}>
            <View style={[styles.bone, { backgroundColor: color }]}>
                <BoneShape />
            </View>
            <View style={styles.boneLabel}>
                <Animated.Text style={[styles.boneLabelText, { color }]}>
                    {label}
                </Animated.Text>
            </View>
        </Animated.View>
    );
}

// Simple bone shape using views
function BoneShape() {
    return (
        <View style={styles.boneShapeContainer}>
            <View style={styles.boneCircleLeft} />
            <View style={styles.boneBody} />
            <View style={styles.boneCircleRight} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 100,
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    bar: {
        width: 8,
        borderRadius: 4,
        minHeight: 20,
    },
    boneContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        flexWrap: 'wrap', // Allow wrapping if many levels
        gap: Spacing.md,
    },
    boneWrapper: {
        alignItems: 'center',
        gap: Spacing.xs,
    },
    bone: {
        width: 50, // Slightly smaller to fit more
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boneLabel: {
        marginTop: Spacing.xs,
    },
    boneLabelText: {
        fontSize: 10,
        fontWeight: '600',
    },
    boneShapeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    boneCircleLeft: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    boneBody: {
        width: 25,
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.4)',
        marginHorizontal: -2,
    },
    boneCircleRight: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
});
