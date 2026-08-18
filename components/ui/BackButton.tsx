import { BorderRadius, Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

interface BackButtonProps {
    /**
     * Intercept the press — e.g. to confirm before leaving. Receives the default
     * navigation action; call it when ready. Omit for immediate navigation.
     */
    onPress?: (goBack: () => void) => void;
    style?: ViewStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function BackButton({ onPress, style }: BackButtonProps) {
    const router = useRouter();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.9);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    // Falling back to home keeps the button alive when there's no history to
    // pop, e.g. a deep link straight into a session report.
    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    const handlePress = () => {
        if (onPress) {
            onPress(goBack);
            return;
        }
        goBack();
    };

    return (
        <AnimatedTouchable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.8}
            style={[styles.button, animatedStyle, style]}
        >
            <Ionicons
                name="chevron-back"
                size={24}
                color={Colors.textPrimary}
                style={styles.icon}
            />
        </AnimatedTouchable>
    );
}

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.cardLight,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    icon: {
        // Optically centre the chevron; its glyph is right-heavy in the em box.
        marginLeft: -2,
    },
});
