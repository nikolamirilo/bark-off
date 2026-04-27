import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    icon,
    style,
    textStyle,
}: ButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    const handlePress = () => {
        // Bounce animation
        scale.value = withSequence(
            withSpring(0.9),
            withSpring(1.05),
            withSpring(1)
        );
        onPress();
    };

    const getButtonStyle = (): ViewStyle => {
        const base: ViewStyle = {
            ...styles.button,
            ...sizeStyles[size],
        };

        switch (variant) {
            case 'primary':
                return { ...base, backgroundColor: Colors.primary };
            case 'secondary':
                return { ...base, backgroundColor: Colors.secondary };
            case 'danger':
                return { ...base, backgroundColor: Colors.accent };
            case 'outline':
                return {
                    ...base,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: Colors.primary,
                };
            default:
                return { ...base, backgroundColor: Colors.primary };
        }
    };

    const getTextStyle = (): TextStyle => {
        const base: TextStyle = {
            ...styles.text,
            ...textSizeStyles[size],
        };

        if (variant === 'outline') {
            return { ...base, color: Colors.primary };
        }

        return { ...base, color: Colors.textLight };
    };

    return (
        <AnimatedTouchable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            style={[
                getButtonStyle(),
                disabled && styles.disabled,
                animatedStyle,
                style,
            ]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' ? Colors.primary : Colors.textLight} />
            ) : (
                <>
                    {icon}
                    <Text style={[getTextStyle(), textStyle]}>{title}</Text>
                </>
            )}
        </AnimatedTouchable>
    );
}

const sizeStyles: Record<string, ViewStyle> = {
    small: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.sm,
    },
    medium: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
    },
    large: {
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
    },
};

const textSizeStyles: Record<string, TextStyle> = {
    small: { fontSize: FontSizes.sm },
    medium: { fontSize: FontSizes.md },
    large: { fontSize: FontSizes.lg },
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    text: {
        fontWeight: FontWeights.bold,
    },
    disabled: {
        opacity: 0.5,
    },
});
