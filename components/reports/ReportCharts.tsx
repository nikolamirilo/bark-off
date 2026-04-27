import { BorderRadius, Colors, FontSizes, FontWeights, Spacing } from '@/constants/Colors';
import { Report } from '@/types';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width - Spacing.lg * 2;

const chartConfig = {
    backgroundColor: Colors.cardLight,
    backgroundGradientFrom: Colors.cardLight,
    backgroundGradientTo: Colors.cardLight,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 140, 66, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(61, 41, 20, ${opacity})`,
    style: {
        borderRadius: BorderRadius.md,
    },
    propsForDots: {
        r: '6',
        strokeWidth: '2',
        stroke: Colors.primary,
    },
};

interface BarkTimelineChartProps {
    report: Report;
}

export function BarkTimelineChart({ report }: BarkTimelineChartProps) {
    if (report.timeline.length === 0) {
        return (
            <View style={styles.emptyChart}>
                <Text style={styles.emptyText}>No bark data for timeline 🐾</Text>
            </View>
        );
    }

    const durationSec = report.duration;
    const sessionStart = new Date(report.timeline[0].timestamp).getTime();

    // Derive bucket interval from the first two timeline points so labels match
    // whatever granularity the report was generated with.
    const intervalSec = report.timeline.length > 1
        ? (new Date(report.timeline[1].timestamp).getTime() - sessionStart) / 1000
        : 60;

    const formatLabel = (elapsedSec: number): string => {
        if (intervalSec < 60) {
            const total = Math.round(elapsedSec);
            const m = Math.floor(total / 60);
            const s = total % 60;
            return `${m}:${s.toString().padStart(2, "0")}`;
        }
        if (durationSec <= 3600) {
            return `${Math.round(elapsedSec / 60)}m`;
        }
        return `${+(elapsedSec / 3600).toFixed(2)}h`;
    };

    const labels = report.timeline.map((point) =>
        formatLabel((new Date(point.timestamp).getTime() - sessionStart) / 1000)
    );

    const titleSuffix = intervalSec < 60 ? "min:sec" : durationSec <= 3600 ? "minutes" : "hours";

    // Get max bark count to configure y-axis
    const maxBarks = Math.max(...report.timeline.map(p => p.barkCount), 1);

    // Determine y-axis segment count based on max value
    let segments = 5;
    if (maxBarks <= 10) {
        segments = maxBarks; // Show each count for small numbers
    } else if (maxBarks <= 20) {
        segments = 4;
    } else {
        segments = 5;
    }

    const data = {
        labels: labels, // Show all data points
        datasets: [
            {
                data: report.timeline.map((point) => point.barkCount),
                color: (opacity = 1) => `rgba(255, 140, 66, ${opacity})`,
                strokeWidth: 3,
            },
        ],
    };

    return (
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>
                📈 Bark Timeline ({titleSuffix})
            </Text>
            <LineChart
                data={data}
                width={screenWidth}
                height={220}
                chartConfig={{
                    ...chartConfig,
                    decimalPlaces: 0,
                }}
                bezier
                style={styles.chart}
                segments={segments}
                fromZero={true}
            />
        </View>
    );
}

interface LevelBreakdownChartProps {
    levelBreakdown: Record<string, number>;
}

export function LevelBreakdownChart({ levelBreakdown }: LevelBreakdownChartProps) {
    const keys = Object.keys(levelBreakdown).sort((a, b) => Number(a) - Number(b)); // Sort by level index
    const total = keys.reduce((sum, key) => sum + levelBreakdown[key], 0);

    if (total === 0) {
        return (
            <View style={styles.emptyChart}>
                <Text style={styles.emptyText}>No woofs recorded yet! 🐶</Text>
            </View>
        );
    }

    const data = {
        labels: keys.map(k => `${k}`),
        datasets: [
            {
                data: keys.map(k => levelBreakdown[k]),
            },
        ],
    };

    const getLevelColor = (idx: number) => {
        const colors = [Colors.levelLow, Colors.levelMedium, Colors.levelHigh, Colors.accent, Colors.secondary];
        return colors[idx % colors.length];
    };

    return (
        <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>📊 Volume Breakdown</Text>
            <BarChart
                data={data}
                width={screenWidth}
                height={200}
                chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(111, 207, 151, ${opacity})`,
                }}
                style={styles.chart}
                showValuesOnTopOfBars
                yAxisLabel=""
                yAxisSuffix=""
            />
            <View style={styles.legendContainer}>
                {keys.map((key, index) => (
                    <View key={key} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: getLevelColor(Number(key) - 1) }]} />
                        <Text style={styles.legendText}>{key}: {levelBreakdown[key]}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

interface ImprovementIndicatorProps {
    comparison?: Report['comparisonWithPrevious'];
}

export function ImprovementIndicator({ comparison }: ImprovementIndicatorProps) {
    if (!comparison) {
        return (
            <View style={styles.improvementContainer}>
                <Text style={styles.improvementEmoji}>🐶</Text>
                <Text style={styles.improvementTitle}>First Session!</Text>
                <Text style={styles.improvementText}>
                    Keep tracking to see your pet's progress!
                </Text>
            </View>
        );
    }

    const { barkCountChange, isImprovement } = comparison;

    return (
        <View style={[
            styles.improvementContainer,
            isImprovement ? styles.improvementPositive : styles.improvementNegative,
        ]}>
            <Text style={styles.improvementEmoji}>
                {isImprovement ? '🎉' : '🐶'}
            </Text>
            <Text style={styles.improvementTitle}>
                {isImprovement ? 'Paw-some Progress!' : 'More Woofs Today'}
            </Text>
            <View style={styles.changeRow}>
                <Text style={[
                    styles.changeText,
                    isImprovement ? styles.positiveChange : styles.negativeChange,
                ]}>
                    {isImprovement ? '↓' : '↑'} {Math.abs(barkCountChange)}%
                </Text>
                <Text style={styles.changeLabel}>
                    {isImprovement ? 'less barks' : 'more barks'}
                </Text>
            </View>
            <Text style={styles.improvementText}>
                {isImprovement
                    ? 'Your pet is getting calmer! Treats deserved! 🦴'
                    : 'Maybe they saw a squirrel? Extra belly rubs needed! 🐿️'}
            </Text>
        </View>
    );
}

interface StatCardProps {
    emoji: string;
    label: string;
    value: string | number;
    subtext?: string;
}

export function StatCard({ emoji, label, value, subtext }: StatCardProps) {
    return (
        <View style={styles.statCard}>
            <Text style={styles.statEmoji}>{emoji}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
            {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    chartContainer: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.md,
    },
    chartTitle: {
        fontSize: FontSizes.lg,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    chart: {
        borderRadius: BorderRadius.md,
        marginLeft: -Spacing.md,
    },
    emptyChart: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: Spacing.md,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendText: {
        fontSize: FontSizes.sm,
        color: Colors.textSecondary,
    },
    improvementContainer: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: Colors.border,
    },
    improvementPositive: {
        borderColor: Colors.success,
        backgroundColor: 'rgba(111, 207, 151, 0.1)',
    },
    improvementNegative: {
        borderColor: Colors.warning,
        backgroundColor: 'rgba(242, 201, 76, 0.1)',
    },
    improvementEmoji: {
        fontSize: 40,
        marginBottom: Spacing.sm,
    },
    improvementTitle: {
        fontSize: FontSizes.xl,
        fontWeight: FontWeights.bold,
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    changeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    changeText: {
        fontSize: FontSizes.xxl,
        fontWeight: FontWeights.bold,
    },
    positiveChange: {
        color: Colors.success,
    },
    negativeChange: {
        color: Colors.warning,
    },
    changeLabel: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
    },
    improvementText: {
        fontSize: FontSizes.md,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    statCard: {
        backgroundColor: Colors.cardLight,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        minWidth: 100,
        flex: 1,
    },
    statEmoji: {
        fontSize: 28,
        marginBottom: Spacing.xs,
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
    statSubtext: {
        fontSize: FontSizes.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
});
