import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BiomarkerChart } from './BiomarkerChart';
import { UnitSelector } from './UnitSelector';
import { getBiomarkerHistory } from '../services/api';
import {
  convertPointClient,
  detectClinicalPanel,
  getAvailableUnitsForMarker,
} from '../services/unitConverter';
import { BiomarkerHistoryPoint, BiomarkerHistoryResponse } from '../types';

interface BiomarkerGraphCardProps {
  markerName: string;
  index: number;
  totalCards: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (markerName: string) => void;
  onSelectBiomarker?: (markerName: string) => void;
}

export const BiomarkerGraphCard: React.FC<BiomarkerGraphCardProps> = ({
  markerName,
  index,
  totalCards,
  onMoveUp,
  onMoveDown,
  onRemove,
}) => {
  const [historyData, setHistoryData] = useState<BiomarkerHistoryResponse | null>(null);
  const [activeUnit, setActiveUnit] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getBiomarkerHistory(markerName);
        if (isMounted) {
          setHistoryData(data);
          setActiveUnit(data.current_unit);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || `No data for ${markerName}`);
          setHistoryData(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [markerName]);

  const availableUnits = useMemo(() => {
    if (!historyData) return [];
    const fromApi = historyData.available_units || [];
    const fromClient = getAvailableUnitsForMarker(markerName, historyData.current_unit);
    return Array.from(new Set([...fromApi, ...fromClient]));
  }, [historyData, markerName]);

  const convertedPoints: BiomarkerHistoryPoint[] = useMemo(() => {
    if (!historyData || !historyData.history) return [];

    return historyData.history.map((p) => {
      if (!activeUnit || p.unit === activeUnit) return p;

      const converted = convertPointClient(
        markerName,
        p.value,
        p.ref_min,
        p.ref_max,
        p.unit,
        activeUnit
      );

      return {
        ...p,
        value: converted.value,
        ref_min: converted.ref_min,
        ref_max: converted.ref_max,
        unit: activeUnit,
      };
    });
  }, [historyData, activeUnit, markerName]);

  const panel = detectClinicalPanel(markerName);

  // Calculate delta between the last two tests
  const deltaInfo = useMemo(() => {
    if (convertedPoints.length < 2) return null;
    const current = convertedPoints[convertedPoints.length - 1].value;
    const prev = convertedPoints[convertedPoints.length - 2].value;
    const diff = current - prev;
    const pct = prev !== 0 ? (diff / prev) * 100 : 0;
    return {
      diff: Number(diff.toFixed(2)),
      pct: Number(pct.toFixed(1)),
      increased: diff > 0,
    };
  }, [convertedPoints]);

  const latestPoint = convertedPoints.length > 0 ? convertedPoints[convertedPoints.length - 1] : null;

  return (
    <View style={styles.card}>
      {/* Card Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Order / Position badge */}
          <View style={styles.positionBadge}>
            <Text style={styles.positionBadgeText}>#{index + 1}</Text>
          </View>

          {/* Reorder Buttons */}
          <View style={styles.reorderButtons}>
            <TouchableOpacity
              style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
              disabled={index === 0}
              onPress={() => onMoveUp(index)}
              accessibilityLabel="Move Up"
            >
              <MaterialCommunityIcons
                name="chevron-up"
                size={18}
                color={index === 0 ? '#CBD5E1' : '#475569'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.reorderBtn,
                index === totalCards - 1 && styles.reorderBtnDisabled,
              ]}
              disabled={index === totalCards - 1}
              onPress={() => onMoveDown(index)}
              accessibilityLabel="Move Down"
            >
              <MaterialCommunityIcons
                name="chevron-down"
                size={18}
                color={index === totalCards - 1 ? '#CBD5E1' : '#475569'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.titleWrapper}>
            <View style={styles.titleRow}>
              <Text style={styles.markerName}>{markerName}</Text>
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeText}>{panel}</Text>
              </View>
            </View>
            <Text style={styles.subMeta}>
              {convertedPoints.length} test{convertedPoints.length !== 1 ? 's' : ''} on record
              {latestPoint?.test_date ? ` • Latest: ${latestPoint.test_date}` : ''}
            </Text>
          </View>
        </View>

        {/* Header Right: Close button */}
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => onRemove(markerName)}
          accessibilityLabel="Close Graph"
        >
          <MaterialCommunityIcons name="close" size={20} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Toolbar / Stats Row */}
      {latestPoint && (
        <View style={styles.toolbar}>
          <View style={styles.statsSummary}>
            <View style={styles.latestValueBox}>
              <Text style={styles.latestValueLabel}>Latest Result</Text>
              <View style={styles.latestValueRow}>
                <Text style={styles.latestValueNum}>{latestPoint.value}</Text>
                <Text style={styles.latestValueUnit}>{activeUnit}</Text>

                {latestPoint.flag && (
                  <View
                    style={[
                      styles.flagPill,
                      latestPoint.flag === 'H' && styles.flagH,
                      latestPoint.flag === 'L' && styles.flagL,
                      latestPoint.flag === 'Normal' && styles.flagNormal,
                    ]}
                  >
                    <Text
                      style={[
                        styles.flagPillText,
                        latestPoint.flag === 'H' && styles.flagTextH,
                        latestPoint.flag === 'L' && styles.flagTextL,
                        latestPoint.flag === 'Normal' && styles.flagTextNormal,
                      ]}
                    >
                      {latestPoint.flag}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Delta vs previous test */}
            {deltaInfo && (
              <View style={styles.deltaBox}>
                <Text style={styles.deltaLabel}>Change from previous</Text>
                <View style={styles.deltaRow}>
                  <MaterialCommunityIcons
                    name={deltaInfo.increased ? 'arrow-up-bold' : 'arrow-down-bold'}
                    size={15}
                    color={deltaInfo.increased ? '#DC2626' : '#16A34A'}
                  />
                  <Text
                    style={[
                      styles.deltaText,
                      { color: deltaInfo.increased ? '#DC2626' : '#16A34A' },
                    ]}
                  >
                    {deltaInfo.diff > 0 ? `+${deltaInfo.diff}` : deltaInfo.diff} {activeUnit} (
                    {deltaInfo.pct > 0 ? `+${deltaInfo.pct}` : deltaInfo.pct}%)
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Unit Selector for this graph */}
          <UnitSelector
            availableUnits={availableUnits}
            activeUnit={activeUnit}
            onSelectUnit={setActiveUnit}
          />
        </View>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      )}

      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Chart View */}
      {!isLoading && !error && convertedPoints.length > 0 && (
        <BiomarkerChart
          points={convertedPoints}
          activeUnit={activeUnit}
          biomarkerName={markerName}
        />
      )}

      {/* Expandable History Table Toggle */}
      {!isLoading && !error && convertedPoints.length > 0 && (
        <View style={styles.tableToggleSection}>
          <TouchableOpacity
            style={styles.tableToggleBtn}
            onPress={() => setShowTable(!showTable)}
          >
            <MaterialCommunityIcons
              name={showTable ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#2563EB"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.tableToggleText}>
              {showTable ? 'Hide Test History' : `Show Test History (${convertedPoints.length})`}
            </Text>
          </TouchableOpacity>

          {showTable && (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Result</Text>
                <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Normal Range</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Flag</Text>
                <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Document</Text>
              </View>

              {convertedPoints.map((p, pIdx) => {
                const isH = Boolean(
                  p.flag === 'H' || (p.ref_max != null && p.value > p.ref_max)
                );
                const isL = Boolean(
                  p.flag === 'L' || (p.ref_min != null && p.value < p.ref_min)
                );

                return (
                  <View
                    key={`${p.lab_id}-${pIdx}`}
                    style={[styles.tableRow, pIdx % 2 === 1 && styles.tableRowAlt]}
                  >
                    <Text style={[styles.td, { flex: 1.5, fontWeight: '600' }]}>
                      {p.test_date || 'No Date'}
                    </Text>

                    <Text
                      style={[
                        styles.td,
                        { flex: 1.2, textAlign: 'center', fontWeight: '700' },
                      ]}
                    >
                      {p.value} <Text style={{ fontSize: 11, color: '#64748B' }}>{activeUnit}</Text>
                    </Text>

                    <Text
                      style={[
                        styles.td,
                        { flex: 1.5, textAlign: 'center', color: '#059669' },
                      ]}
                    >
                      {p.ref_min !== null || p.ref_max !== null
                        ? `${p.ref_min ?? ''} - ${p.ref_max ?? ''}`
                        : p.reference_range_raw || '-'}
                    </Text>

                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <View
                        style={[
                          styles.flagPill,
                          isH && styles.flagH,
                          isL && styles.flagL,
                          !isH && !isL && styles.flagNormal,
                        ]}
                      >
                        <Text
                          style={[
                            styles.flagPillText,
                            isH && styles.flagTextH,
                            isL && styles.flagTextL,
                            !isH && !isL && styles.flagTextNormal,
                          ]}
                        >
                          {p.flag || (isH ? 'H' : isL ? 'L' : 'Normal')}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.td,
                        { flex: 2, textAlign: 'right', color: '#64748B' },
                      ]}
                      numberOfLines={1}
                    >
                      {p.filename}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  positionBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  reorderButtons: {
    flexDirection: 'column',
    marginRight: 10,
  },
  reorderBtn: {
    padding: 1,
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  titleWrapper: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  markerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  panelBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  panelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
  },
  subMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  latestValueBox: {},
  latestValueLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  latestValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  latestValueNum: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  latestValueUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  deltaBox: {},
  deltaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  flagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  flagH: {
    backgroundColor: '#FEE2E2',
  },
  flagL: {
    backgroundColor: '#FEF3C7',
  },
  flagNormal: {
    backgroundColor: '#DCFCE7',
  },
  flagPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  flagTextH: {
    color: '#DC2626',
  },
  flagTextL: {
    color: '#D97706',
  },
  flagTextNormal: {
    color: '#16A34A',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  tableToggleSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  tableToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  tableToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  tableContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  td: {
    fontSize: 12,
    color: '#0F172A',
  },
});
