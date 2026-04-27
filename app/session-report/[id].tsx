import {
    BarkTimelineChart,
    ImprovementIndicator,
    LevelBreakdownChart,
    StatCard,
} from '@/components/reports/ReportCharts';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { formatDuration, getImprovementMessage } from '@/services/reportService';
import { useReports } from '@/store/appStore';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ReportDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const reports = useReports();

    const report = reports.find((r) => r.id === id);

    if (!report) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>🐶</Text>
                <Text style={styles.errorText}>Report not found!</Text>
                <Button
                    title="Go Back"
                    onPress={() => router.back()}
                    variant="primary"
                />
            </View>
        );
    }

    const formatDateFull = (date: Date) => {
        return new Date(date).toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>📊 Session Report</Text>
                <Text style={styles.date}>
                    📅 {formatDateFull(report.generatedAt)}
                </Text>
            </View>

            {/* Summary Stats */}
            <Card emoji="🦴" title="WOOF SUMMARY" style={styles.summaryCard}>
                <View style={styles.statsRow}>
                    <StatCard
                        emoji="🐶"
                        label="Total Woofs"
                        value={report.totalBarks}
                    />
                    <StatCard
                        emoji="🔊"
                        label="Sounds Played"
                        value={report.soundsPlayed}
                    />
                </View>
                <View style={styles.statsRow}>
                    <StatCard
                        emoji="⏱️"
                        label="Duration"
                        value={formatDuration(report.duration)}
                    />
                    <StatCard
                        emoji="📊"
                        label="Barks/Min"
                        value={(report.totalBarks / Math.max(report.duration / 60, 1)).toFixed(1)}
                        subtext={report.duration < 60 ? '(under 1 min)' : undefined}
                    />
                </View>
            </Card>

            {/* Volume Stats */}
            <Card style={styles.volumeCard}>
                <View style={styles.volumeRow}>
                    <View style={styles.volumeStat}>
                        <Text style={styles.volumeLabel}>Average Volume</Text>
                        <Text style={styles.volumeValue}>{report.averageVolume} dB</Text>
                    </View>
                    <View style={styles.volumeDivider} />
                    <View style={styles.volumeStat}>
                        <Text style={styles.volumeLabel}>Peak Volume</Text>
                        <Text style={[styles.volumeValue, styles.peakValue]}>
                            {report.peakVolume} dB
                        </Text>
                    </View>
                </View>
            </Card>

            {/* Timeline Chart */}
            <BarkTimelineChart report={report} />

            {/* Level Breakdown */}
            <LevelBreakdownChart levelBreakdown={report.levelBreakdown} />

            {/* Improvement Indicator */}
            <View style={styles.improvementSection}>
                <Text style={styles.sectionTitle}>✨ Progress</Text>
                <ImprovementIndicator comparison={report.comparisonWithPrevious} />
                <Text style={styles.improvementMessage}>
                    {getImprovementMessage(report)}
                </Text>
            </View>

            {/* Bark Log */}
            <Card emoji="📜" title="BARK LOG" style={styles.logCard}>
                {report.timeline.length > 0 ? (
                    report.timeline.map((point, index) => (
                        <View key={index} style={styles.logItem}>
                            <Text style={styles.logTime}>
                                {new Date(point.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </Text>
                            <Text style={styles.logCount}>{point.barkCount} woofs</Text>
                            <Text style={styles.logVolume}>
                                Avg: {point.avgVolume.toFixed(1)} dB
                            </Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.noLogText}>No detailed log available</Text>
                )}
            </Card>

            {/* Actions */}
            <View style={styles.actions}>
                <Button
                    title="← Back to Bark-tivities"
                    onPress={() => router.back()}
                    variant="outline"
                />
            </View>
        </ScrollView>
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
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    date: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    summaryCard: {
        marginBottom: Spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    volumeCard: {
        marginBottom: Spacing.md,
    },
    volumeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    volumeStat: {
        flex: 1,
        alignItems: 'center',
    },
    volumeDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.border,
    },
    volumeLabel: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    volumeValue: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginTop: Spacing.xs,
    },
    peakValue: {
        color: Colors.accent,
    },
    improvementSection: {
        marginBottom: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    improvementMessage: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.md,
        fontStyle: 'italic',
    },
    logCard: {
        marginBottom: Spacing.lg,
    },
    logItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    logTime: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        flex: 1,
    },
    logCount: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.semibold,
        color: Colors.textPrimary,
        flex: 1,
        textAlign: 'center',
    },
    logVolume: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        flex: 1,
        textAlign: 'right',
    },
    noLogText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingVertical: Spacing.md,
    },
    actions: {
        marginBottom: Spacing.xl,
    },
    // Error state
    errorContainer: {
        flex: 1,
        backgroundColor: Colors.backgroundLight,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    errorEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    errorText: {
        fontSize: FontSizes.lg,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
});
