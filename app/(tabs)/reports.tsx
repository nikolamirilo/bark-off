import { Card } from '@/components/ui/Card';
import { BorderRadius, Colors, DogText, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { formatDuration } from '@/services/reportService';
import { useReports } from '@/store/appStore';
import { Report } from '@/types';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export default function ReportsScreen() {
    const router = useRouter();
    const reports = useReports();

    const formatDate = (date: Date) => {
        const d = new Date(date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) {
            return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        if (d.toDateString() === yesterday.toDateString()) {
            return `Yesterday, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        return d.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderReportCard = ({ item: report }: { item: Report }) => {
        const hasImprovement = report.comparisonWithPrevious?.isImprovement;
        const changePercent = report.comparisonWithPrevious?.barkCountChange;

        return (
            <TouchableOpacity
                style={styles.reportCard}
                onPress={() => router.push(`/session-report/${report.id}`)}
                activeOpacity={0.8}
            >
                <View style={styles.reportHeader}>
                    <Text style={styles.reportDate}>
                        📅 {formatDate(report.generatedAt)}
                    </Text>
                    {report.comparisonWithPrevious && (
                        <View style={[
                            styles.changeBadge,
                            hasImprovement ? styles.improvementBadge : styles.regressionBadge,
                        ]}>
                            <Text style={styles.changeBadgeText}>
                                {hasImprovement ? '↓' : '↑'} {Math.abs(changePercent || 0)}%
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.reportStats}>
                    <View style={styles.reportStat}>
                        <Text style={styles.statIcon}>⏱️</Text>
                        <Text style={styles.statText}>{formatDuration(report.duration)}</Text>
                    </View>
                    <View style={styles.reportStat}>
                        <Text style={styles.statIcon}>🐶</Text>
                        <Text style={styles.statText}>{report.totalBarks} woofs</Text>
                    </View>
                    <View style={styles.reportStat}>
                        <Text style={styles.statIcon}>📈</Text>
                        <Text style={styles.statText}>Peak: {report.peakVolume} dB</Text>
                    </View>
                </View>

                <View style={styles.reportFooter}>
                    {report.comparisonWithPrevious ? (
                        <Text style={[
                            styles.improvementText,
                            hasImprovement ? styles.positiveText : styles.warningText,
                        ]}>
                            {hasImprovement
                                ? '✅ Less woofs than before!'
                                : '⚠️ More woofs than before'}
                        </Text>
                    ) : (
                        <Text style={styles.firstSessionText}>
                            🐾 First session recorded
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    if (reports.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📊</Text>
                <Text style={styles.emptyTitle}>No Bark-tivities Yet!</Text>
                <Text style={styles.emptyText}>{DogText.noReports}</Text>
                <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => router.push('/listening')}
                >
                    <Text style={styles.startButtonText}>Start First Session 🎧</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Calculate weekly summary
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyReports = reports.filter(
        (r) => new Date(r.generatedAt).getTime() > oneWeekAgo
    );
    const weeklyBarks = weeklyReports.reduce((sum, r) => sum + r.totalBarks, 0);
    const weeklyDuration = weeklyReports.reduce((sum, r) => sum + r.duration, 0);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{DogText.reportsTitle}</Text>
                <Text style={styles.subtitle}>Track your pet's progress!</Text>
            </View>

            {/* Weekly Summary */}
            <Card variant="elevated" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryTitle}>📊 This Week</Text>
                </View>
                <View style={styles.summaryStats}>
                    <View style={styles.summaryStat}>
                        <Text style={styles.summaryValue}>{weeklyReports.length}</Text>
                        <Text style={styles.summaryLabel}>Sessions</Text>
                    </View>
                    <View style={styles.summaryStat}>
                        <Text style={styles.summaryValue}>{weeklyBarks}</Text>
                        <Text style={styles.summaryLabel}>Total Woofs</Text>
                    </View>
                    <View style={styles.summaryStat}>
                        <Text style={styles.summaryValue}>{formatDuration(weeklyDuration)}</Text>
                        <Text style={styles.summaryLabel}>Total Time</Text>
                    </View>
                </View>
            </Card>

            {/* Reports List */}
            <FlatList
                data={reports}
                renderItem={renderReportCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundLight,
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
    },
    title: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    subtitle: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        marginTop: Spacing.xs,
    },
    summaryCard: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    summaryHeader: {
        marginBottom: Spacing.md,
    },
    summaryTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    summaryStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    summaryStat: {
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.primary,
    },
    summaryLabel: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: Spacing.sm,
    },
    reportCard: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    reportHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    reportDate: {
        fontSize: FontSizes.md,
        fontWeight: FontWeights.semibold,
        color: Colors.textPrimary,
    },
    changeBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.sm,
    },
    improvementBadge: {
        backgroundColor: Colors.success + '20',
    },
    regressionBadge: {
        backgroundColor: Colors.warning + '20',
    },
    changeBadgeText: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
    },
    reportStats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    reportStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    statIcon: {
        fontSize: 16,
    },
    statText: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    reportFooter: {
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    improvementText: {
        fontSize: FontSizes.sm,
        fontWeight: FontWeights.medium,
    },
    positiveText: {
        color: Colors.success,
    },
    warningText: {
        color: Colors.warning,
    },
    firstSessionText: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    // Empty state
    emptyContainer: {
        flex: 1,
        backgroundColor: Colors.backgroundLight,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    emptyTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    emptyText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    startButton: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
    },
    startButtonText: {
        color: Colors.textLight,
        fontSize: FontSizes.md,
        fontWeight: FontWeights.bold,
    },
});
