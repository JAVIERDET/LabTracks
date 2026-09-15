import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BiomarkerChart } from '../components/BiomarkerChart';
import { UnitSelector } from '../components/UnitSelector';
import { getBiomarkerHistory, listBiomarkers } from '../services/api';
import { convertPointClient, getAvailableUnitsForMarker } from '../services/unitConverter';
import { BiomarkerHistoryPoint, BiomarkerHistoryResponse } from '../types';

interface TrendsScreenProps {
  initialBiomarker?: string;
}

export const TrendsScreen: React.FC<TrendsScreenProps> = ({ initialBiomarker }) => {
  const [allBiomarkers, setAllBiomarkers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialBiomarker || 'Triglycerides');
  const [selectedMarker, setSelectedMarker] = useState<string>(initialBiomarker || 'Triglycerides');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [historyData, setHistoryData] = useState<BiomarkerHistoryResponse | null>(null);
  const [activeUnit, setActiveUnit] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Load available biomarker names for autocomplete
  useEffect(() => {
    loadBiomarkersList();
  }, []);

  useEffect(() => {
    if (initialBiomarker) {
      setSearchQuery(initialBiomarker);
      setSelectedMarker(initialBiomarker);
    }
  }, [initialBiomarker]);

  useEffect(() => {
    if (selectedMarker) {
      fetchHistory(selectedMarker);
    }
  }, [selectedMarker]);

  const loadBiomarkersList = async () => {
    try {
      const list = await listBiomarkers();
      setAllBiomarkers(list);
      if (list.length > 0 && !initialBiomarker) {
        // Default to first marker or Triglycerides if available
        const defaultMarker = list.find((m) => m.toLowerCase().includes('triglyceride')) || list[0];
        setSearchQuery(defaultMarker);
        setSelectedMarker(defaultMarker);
      }
    } catch (err) {
      console.error('Failed to load biomarkers list:', err);
    }
  };

  const fetchHistory = async (marker: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await getBiomarkerHistory(marker);
      setHistoryData(res);
      setActiveUnit(res.current_unit);
    } catch (err: any) {
      setError(err.message || `No history found for "${marker}"`);
      setHistoryData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return allBiomarkers.slice(0, 6);
    return allBiomarkers
      .filter((m) => m.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 6);
  }, [searchQuery, allBiomarkers]);

  const availableUnits = useMemo(() => {
    if (!historyData) return [];
    const fromApi = historyData.available_units || [];
    const fromClient = getAvailableUnitsForMarker(selectedMarker, historyData.current_unit);
    return Array.from(new Set([...fromApi, ...fromClient]));
  }, [historyData, selectedMarker]);

  // Live real-time conversion for plotted points and reference bounds
  const convertedPoints: BiomarkerHistoryPoint[] = useMemo(() => {
    if (!historyData || !historyData.history) return [];

    return historyData.history.map((p) => {
      if (!activeUnit || p.unit === activeUnit) return p;

      const converted = convertPointClient(
        selectedMarker,
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
  }, [historyData, activeUnit, selectedMarker]);

  const handleSelectUnit = (unit: string) => {
    setActiveUnit(unit);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>Biomarker Trends & Reference Limits</Text>
        <Text style={styles.subtitle}>
          Track changes over time with healthy reference intervals and real-time unit conversion.
        </Text>
      </View>

      {/* Search Bar with Autocomplete */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={22} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search biomarker (e.g. Triglycerides, Glucose, HDL)..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setShowSuggestions(true);
              }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsDropdown}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.suggestionItem}
                onPress={() => {
                  setSearchQuery(item);
                  setSelectedMarker(item);
                  setShowSuggestions(false);
                }}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color="#2563EB"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Unit Selector Bar */}
      {historyData && (
        <View style={styles.controlBar}>
          <View style={styles.markerInfo}>
            <Text style={styles.activeMarkerName}>{selectedMarker}</Text>
            <Text style={styles.markerMeta}>
              {convertedPoints.length} test{convertedPoints.length > 1 ? 's' : ''} on record
            </Text>
          </View>

          <UnitSelector
            availableUnits={availableUnits}
            activeUnit={activeUnit}
            onSelectUnit={handleSelectUnit}
          />
        </View>
      )}

      {/* Loading state */}
      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loaderText}>Loading trend history for {selectedMarker}...</Text>
        </View>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <View style={styles.errorBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSub}>Upload a lab report containing this biomarker to visualize trends.</Text>
        </View>
      )}

      {/* Chart */}
      {!isLoading && !error && historyData && (
        <>
          <BiomarkerChart
            points={convertedPoints}
            activeUnit={activeUnit}
            biomarkerName={selectedMarker}
          />

          {/* Tabular History Breakdown */}
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>Historical Test Breakdown</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 1.5 }]}>Date</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Result</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Normal Range</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Flag</Text>
              <Text style={[styles.th, { flex: 2, textAlign: 'right' }]}>Document</Text>
            </View>

            {convertedPoints.map((p, idx) => {
              const isHigh = Boolean(p.flag === 'H' || (p.ref_max != null && p.value > p.ref_max));
              const isLow = Boolean(p.flag === 'L' || (p.ref_min != null && p.value < p.ref_min));
              return (
                <View
                  key={`${p.lab_id}-${idx}`}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <Text style={[styles.td, { flex: 1.5, fontWeight: '600' }]}>
                    {p.test_date || 'No Date'}
                  </Text>

                  <Text style={[styles.td, { flex: 1.2, textAlign: 'center', fontWeight: '700' }]}>
                    {p.value} <Text style={{ fontSize: 11, color: '#64748B' }}>{activeUnit}</Text>
                  </Text>

                  <Text style={[styles.td, { flex: 1.5, textAlign: 'center', color: '#059669' }]}>
                    {p.ref_min !== null || p.ref_max !== null
                      ? `${p.ref_min ?? ''} - ${p.ref_max ?? ''}`
                      : p.reference_range_raw || 'Standard'}
                  </Text>

                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View
                      style={[
                        styles.statusPill,
                        isHigh && styles.pillHigh,
                        isLow && styles.pillLow,
                        !isHigh && !isLow && styles.pillNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isHigh && styles.statusTextHigh,
                          isLow && styles.statusTextLow,
                          !isHigh && !isLow && styles.statusTextNormal,
                        ]}
                      >
                        {isHigh ? 'High' : isLow ? 'Low' : 'Normal'}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[styles.td, { flex: 2, textAlign: 'right', color: '#64748B', fontSize: 12 }]}
                    numberOfLines={1}
                  >
                    {p.filename}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 24,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  searchSection: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  markerInfo: {
    flex: 1,
  },
  activeMarkerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  markerMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginVertical: 20,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  errorSub: {
    color: '#991B1B',
    fontSize: 13,
    marginTop: 4,
  },
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  td: {
    fontSize: 13,
    color: '#1E293B',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillHigh: {
    backgroundColor: '#FEE2E2',
  },
  pillLow: {
    backgroundColor: '#FEF3C7',
  },
  pillNormal: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextHigh: {
    color: '#DC2626',
  },
  statusTextLow: {
    color: '#D97706',
  },
  statusTextNormal: {
    color: '#16A34A',
  },
});
