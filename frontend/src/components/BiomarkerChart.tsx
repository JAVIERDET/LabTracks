import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { BiomarkerHistoryPoint } from '../types';

interface BiomarkerChartProps {
  points: BiomarkerHistoryPoint[];
  activeUnit: string;
  biomarkerName: string;
}

export const BiomarkerChart: React.FC<BiomarkerChartProps> = ({
  points,
  activeUnit,
  biomarkerName,
}) => {
  const [containerWidth, setContainerWidth] = useState(650);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setContainerWidth(width);
    }
  };

  if (!points || points.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No historical data available for this biomarker.</Text>
      </View>
    );
  }

  const height = 300;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 28;
  const paddingBottom = 45;

  const chartWidth = Math.max(containerWidth, 340);
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Gather values and bounds
  const allValues = points.map((p) => p.value);
  const refMins = points.map((p) => p.ref_min).filter((v): v is number => v !== null && v !== undefined);
  const refMaxs = points.map((p) => p.ref_max).filter((v): v is number => v !== null && v !== undefined);

  let minY = Math.min(...allValues, ...(refMins.length > 0 ? refMins : allValues));
  let maxY = Math.max(...allValues, ...(refMaxs.length > 0 ? refMaxs : allValues));

  // Add breathing room
  const range = maxY - minY || 10;
  minY = Math.max(0, minY - range * 0.15);
  maxY = maxY + range * 0.18;

  const getY = (val: number) => {
    const norm = (val - minY) / (maxY - minY || 1);
    return paddingTop + plotHeight - norm * plotHeight;
  };

  const getX = (idx: number) => {
    if (points.length === 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (idx / (points.length - 1)) * plotWidth;
  };

  // Build path
  const pathD = points.reduce((acc, p, idx) => {
    const x = getX(idx);
    const y = getY(p.value);
    return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Representative reference range (e.g. from most recent or common)
  const commonRefMin = refMins.length > 0 ? refMins[refMins.length - 1] : null;
  const commonRefMax = refMaxs.length > 0 ? refMaxs[refMaxs.length - 1] : null;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = minY + (i / (tickCount - 1)) * (maxY - minY);
    return Number(val.toFixed(val > 10 ? 1 : 2));
  });

  const selectedPoint =
    selectedPointIndex !== null && points[selectedPointIndex]
      ? points[selectedPointIndex]
      : null;

  return (
    <View style={styles.card} onLayout={handleLayout}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.chartTitle}>{biomarkerName} Trend</Text>
          <Text style={styles.chartSubtitle}>
            {points.length} record{points.length > 1 ? 's' : ''} over time ({activeUnit})
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Normal Zone</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.legendText}>Result</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendText}>High / Low</Text>
          </View>
        </View>
      </View>

      <View style={styles.svgWrapper}>
        <Svg width={chartWidth} height={height}>
          {/* Shaded Normal Reference Zone (if available) */}
          {commonRefMax !== null && (
            <Rect
              x={paddingLeft}
              y={getY(commonRefMax)}
              width={plotWidth}
              height={
                commonRefMin !== null
                  ? getY(commonRefMin) - getY(commonRefMax)
                  : getY(minY) - getY(commonRefMax)
              }
              fill="rgba(16, 185, 129, 0.12)"
            />
          )}

          {/* Grid lines and Y labels */}
          {yTicks.map((val) => {
            const y = getY(val);
            return (
              <G key={`ytick-${val}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + plotWidth}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="2,3"
                />
                <SvgText
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill="#94A3B8"
                  fontSize="10"
                  textAnchor="end"
                >
                  {val}
                </SvgText>
              </G>
            );
          })}

          {/* Upper reference limit dashed line */}
          {commonRefMax !== null && (
            <G>
              <Line
                x1={paddingLeft}
                y1={getY(commonRefMax)}
                x2={paddingLeft + plotWidth}
                y2={getY(commonRefMax)}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <SvgText
                x={paddingLeft + plotWidth - 4}
                y={getY(commonRefMax) - 5}
                fill="#059669"
                fontSize="9"
                fontWeight="bold"
                textAnchor="end"
              >
                Max: {commonRefMax} {activeUnit}
              </SvgText>
            </G>
          )}

          {/* Lower reference limit dashed line */}
          {commonRefMin !== null && (
            <G>
              <Line
                x1={paddingLeft}
                y1={getY(commonRefMin)}
                x2={paddingLeft + plotWidth}
                y2={getY(commonRefMin)}
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <SvgText
                x={paddingLeft + plotWidth - 4}
                y={getY(commonRefMin) + 12}
                fill="#059669"
                fontSize="9"
                fontWeight="bold"
                textAnchor="end"
              >
                Min: {commonRefMin} {activeUnit}
              </SvgText>
            </G>
          )}

          {/* If individual points have varying reference ranges, draw individual whiskers */}
          {points.map((p, idx) => {
            if (p.ref_min === null && p.ref_max === null) return null;
            const x = getX(idx);
            const pMinY = p.ref_min !== null && p.ref_min !== undefined ? getY(p.ref_min) : null;
            const pMaxY = p.ref_max !== null && p.ref_max !== undefined ? getY(p.ref_max) : null;

            return (
              <G key={`var-ref-${idx}`}>
                {pMinY !== null && pMaxY !== null && (
                  <Line
                    x1={x}
                    y1={pMaxY}
                    x2={x}
                    y2={pMinY}
                    stroke="rgba(16, 185, 129, 0.35)"
                    strokeWidth="4"
                  />
                )}
              </G>
            );
          })}

          {/* Trend Polyline */}
          {points.length > 1 && (
            <Path
              d={pathD}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {points.map((p, idx) => {
            const x = getX(idx);
            const y = getY(p.value);
            const isSelected = selectedPointIndex === idx;

            // Color coding based on flag or reference bounds
            let pointColor = '#10B981'; // Normal
            if (p.flag === 'H' || (p.ref_max && p.value > p.ref_max)) {
              pointColor = '#DC2626'; // High
            } else if (p.flag === 'L' || (p.ref_min && p.value < p.ref_min)) {
              pointColor = '#D97706'; // Low
            }

            return (
              <G key={`point-${idx}`}>
                {/* Active selection halo */}
                {isSelected && (
                  <Circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill={pointColor}
                    fillOpacity="0.2"
                  />
                )}
                <Circle
                  cx={x}
                  cy={y}
                  r={isSelected ? '6' : '4.5'}
                  fill={pointColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  onPress={() => setSelectedPointIndex(idx)}
                />
                {/* X-axis date labels */}
                <SvgText
                  x={x}
                  y={paddingTop + plotHeight + 18}
                  fill="#64748B"
                  fontSize="9.5"
                  textAnchor="middle"
                >
                  {p.test_date ? p.test_date.slice(5) : 'N/A'}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Interactive Tooltip Card for Selected Point */}
      {selectedPoint && (
        <View style={styles.selectedPointCard}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipDate}>
              {selectedPoint.test_date || 'No Date Specified'}
            </Text>
            <View
              style={[
                styles.flagBadge,
                selectedPoint.flag === 'H'
                  ? styles.flagHigh
                  : selectedPoint.flag === 'L'
                  ? styles.flagLow
                  : styles.flagNormal,
              ]}
            >
              <Text
                style={[
                  styles.flagText,
                  selectedPoint.flag === 'H'
                    ? styles.flagTextHigh
                    : selectedPoint.flag === 'L'
                    ? styles.flagTextLow
                    : styles.flagTextNormal,
                ]}
              >
                {selectedPoint.flag === 'H'
                  ? 'HIGH'
                  : selectedPoint.flag === 'L'
                  ? 'LOW'
                  : 'NORMAL'}
              </Text>
            </View>
          </View>

          <View style={styles.tooltipBody}>
            <View style={styles.tooltipMetric}>
              <Text style={styles.tooltipMetricLabel}>Measured Value</Text>
              <Text style={styles.tooltipMetricVal}>
                {selectedPoint.value} <Text style={styles.tooltipMetricUnit}>{activeUnit}</Text>
              </Text>
            </View>

            <View style={styles.tooltipMetric}>
              <Text style={styles.tooltipMetricLabel}>Reference Interval</Text>
              <Text style={styles.tooltipMetricRef}>
                {selectedPoint.reference_range_raw ||
                  (selectedPoint.ref_min !== null || selectedPoint.ref_max !== null
                    ? `${selectedPoint.ref_min ?? ''} - ${selectedPoint.ref_max ?? ''} ${activeUnit}`
                    : 'Standard')}
              </Text>
            </View>

            <View style={styles.tooltipMetric}>
              <Text style={styles.tooltipMetricLabel}>Document</Text>
              <Text style={styles.tooltipDocName} numberOfLines={1}>
                {selectedPoint.filename}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  chartSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  svgWrapper: {
    alignItems: 'center',
    marginVertical: 4,
    overflow: 'hidden',
  },
  selectedPointCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tooltipDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  flagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flagHigh: {
    backgroundColor: '#FEE2E2',
  },
  flagLow: {
    backgroundColor: '#FEF3C7',
  },
  flagNormal: {
    backgroundColor: '#DCFCE7',
  },
  flagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  flagTextHigh: {
    color: '#DC2626',
  },
  flagTextLow: {
    color: '#D97706',
  },
  flagTextNormal: {
    color: '#16A34A',
  },
  tooltipBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  tooltipMetric: {
    minWidth: 90,
  },
  tooltipMetricLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  tooltipMetricVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  tooltipMetricUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  tooltipMetricRef: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  tooltipDocName: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    maxWidth: 160,
  },
  emptyContainer: {
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
  },
});

