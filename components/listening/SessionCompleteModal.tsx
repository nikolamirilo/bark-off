import { Button } from '@/components/ui/Button';
import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SessionCompleteModalProps {
    visible: boolean;
    onClose: () => void;
    onViewReport: () => void;
    stats: {
        barkCount: number;
        duration: string;
        soundsPlayed: number;
    };
    reportId?: string;
}

export function SessionCompleteModal({ visible, onClose, onViewReport, stats, reportId }: SessionCompleteModalProps) {
    const handleDonate = async () => {
        const url = 'https://www.buymeacoffee.com/reactify.solutions';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.emoji}>🎉</Text>
                        <Text style={styles.title}>Session Complete!</Text>
                        <Text style={styles.subtitle}>Great job being a good doggo!</Text>
                    </View>

                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.duration}</Text>
                            <Text style={styles.statLabel}>Duration</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.barkCount}</Text>
                            <Text style={styles.statLabel}>Woofs</Text>
                        </View>
                        <View style={styles.verticalDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{stats.soundsPlayed}</Text>
                            <Text style={styles.statLabel}>Calmed</Text>
                        </View>
                    </View>

                    {/* Donation Section */}
                    <TouchableOpacity
                        style={styles.donationCard}
                        onPress={handleDonate}
                        activeOpacity={0.9}
                    >
                        <LinearGradient
                            colors={['#FFDD00', '#FBB03B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.donationGradient}
                        >
                            <Text style={styles.donationEmoji}>☕</Text>
                            <View style={styles.donationTextContainer}>
                                <Text style={styles.donationTitle}>Buy us a Coffee?</Text>
                                <Text style={styles.donationText}>
                                    As a thank you for this app you can donate us money and make this app improve even more!
                                </Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.actions}>
                        {reportId && (
                            <Button
                                title="View Report"
                                onPress={onViewReport}
                                variant="primary"
                                size="large"
                                style={styles.mainButton}
                            />
                        )}
                        <Button
                            title="Close"
                            onPress={onClose}
                            variant="danger"
                            style={styles.closeButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    content: {
        backgroundColor: Colors.backgroundLight,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emoji: {
        fontSize: 48,
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: Colors.backgroundLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    verticalDivider: {
        width: 1,
        height: '80%',
        backgroundColor: Colors.border,
        alignSelf: 'center',
    },
    statValue: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    statLabel: {
        fontSize: FontSizes.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    donationCard: {
        width: '100%',
        marginBottom: Spacing.lg,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#FBB03B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    donationGradient: {
        flexDirection: 'row',
        padding: Spacing.md,
        alignItems: 'center',
    },
    donationEmoji: {
        fontSize: 32,
        marginRight: Spacing.md,
    },
    donationTextContainer: {
        flex: 1,
    },
    donationTitle: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
        color: '#5D4037', // Brownish text for coffee theme
        marginBottom: 2,
    },
    donationText: {
        fontSize: FontSizes.xs,
        color: '#5D4037',
        lineHeight: 16,
    },
    actions: {
        width: '100%',
        gap: Spacing.md,
    },
    mainButton: {
        width: '100%',
    },
    closeButton: {
        width: '100%',
        marginTop: Spacing.sm,
    },
});
