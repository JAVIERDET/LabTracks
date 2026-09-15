import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BiomarkerGraphCard } from '../components/BiomarkerGraphCard';
import { BiomarkerSearchDropdown } from '../components/BiomarkerSearchDropdown';
import { getBiomarkerCatalog } from '../services/api';
import {
  detectClinicalPanel,
  sortBiomarkersIntelligently,
} from '../services/unitConverter';
import { BiomarkerCatalogItem, SortMode } from '../types';

interface TrendsScreenProps {
  initialBiomarker?: string;
}

export const TrendsScreen: React.FC<TrendsScreenProps> = ({ initialBiomarker }) => {
  const [catalog, setCatalog] = useState<BiomarkerCatalogItem[]>([]);
  const [activeMarkers, setActiveMarkers] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('clinical');
  const [gridColumns, setGridColumns] = useState<1 | 2>(1);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Load catalog on mount
  useEffect(() => {
    loadCatalog();
  }, []);

  // Handle initial biomarker prop from other screens (e.g. Upload or Archive)
  useEffect(() => {
    if (initialBiomarker) {
      setActiveMarkers((prev) => {
        if (!prev.includes(initialBiomarker)) {
          return [initialBiomarker, ...prev];
        }
        return prev;
      });
    }
  }, [initialBiomarker]);

  const loadCatalog = async () => {
    try {
      setIsLoadingCatalog(true);
      const data = await getBiomarkerCatalog();
      setCatalog(data);

      // If no active markers yet and no initialBiomarker, select standard default
      if (data.length > 0 && activeMarkers.length === 0 && !initialBiomarker) {
        const defaultNames: string[] = [];
        const lipid = data.find((d) =>
          d.name.toLowerCase().includes('triglycerid') ||
          d.name.toLowerCase().includes('cholesterol')
        );
        const glucose = data.find((d) => d.name.toLowerCase().includes('glucose'));

        if (lipid) defaultNames.push(lipid.name);
        if (glucose && !defaultNames.includes(glucose.name)) defaultNames.push(glucose.name);

        if (defaultNames.length === 0 && data[0]) {
          defaultNames.push(data[0].name);
        }
        setActiveMarkers(defaultNames);
      }
    } catch (err) {
      console.error('Failed to load biomarker catalog:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const catalogMap = useMemo(() => {
    const map: Record<string, BiomarkerCatalogItem> = {};
    for (const item of catalog) {
      map[item.name] = item;
    }
    return map;
  }, [catalog]);

  // Sorted active markers based on sortMode
  const sortedActiveMarkers = useMemo(() => {
    return sortBiomarkersIntelligently(activeMarkers, sortMode, catalogMap);
  }, [activeMarkers, sortMode, catalogMap]);

  // Adding or toggling biomarker
  const handleSelectMarker = (markerName: string) => {
    setActiveMarkers((prev) => {
      if (prev.includes(markerName)) {
        return prev;
      }
      const updated = [...prev, markerName];
      // Keep intelligent sort if not in custom manual mode
      if (sortMode !== 'custom') {
        return sortBiomarkersIntelligently(updated, sortMode, catalogMap);
      }
      return updated;
    });
  };

  const handleRemoveMarker = (markerName: string) => {
    setActiveMarkers((prev) => prev.filter((m) => m !== markerName));
  };

  // Reorder controls
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setSortMode('custom');
    setActiveMarkers((prev) => {
      const list = [...sortedActiveMarkers];
      const temp = list[index - 1];
      list[index - 1] = list[index];
      list[index] = temp;
      return list;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= sortedActiveMarkers.length - 1) return;
    setSortMode('custom');
    setActiveMarkers((prev) => {
      const list = [...sortedActiveMarkers];
      const temp = list[index + 1];
      list[index + 1] = list[index];
      list[index] = temp;
      return list;
    });
  };

  // Preset loaders
  const loadPanelPreset = (panelName: string) => {
    const matches = catalog
      .filter((item) => detectClinicalPanel(item.name) === panelName)
      .map((item) => item.name);

    if (matches.length > 0) {
      setActiveMarkers((prev) => {
        const merged = Array.from(new Set([...prev, ...matches]));
        return sortBiomarkersIntelligently(merged, 'clinical', catalogMap);
      });
      setSortMode('clinical');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Title Section */}
      <View style={styles.titleSection}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Biomarker Trends & Multi-Graph Comparison</Text>
          <Text style={styles.subtitle}>
            Select multiple parameters to compare historical trajectories, clinical panels, and reference intervals simultaneously.
          </Text>
        </View>

        {/* Column Layout Toggle for Web / Desktop */}
        {Platform.OS === 'web' && (
          <View style={styles.layoutToggleRow}>
            <TouchableOpacity
              style={[styles.layoutBtn, gridColumns === 1 && styles.layoutBtnActive]}
              onPress={() => setGridColumns(1)}
              accessibilityLabel="Single column stacked"
            >
              <MaterialCommunityIcons
                name="view-agenda-outline"
                size={18}
                color={gridColumns === 1 ? '#2563EB' : '#64748B'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.layoutBtn, gridColumns === 2 && styles.layoutBtnActive]}
              onPress={() => setGridColumns(2)}
              accessibilityLabel="Two column grid"
            >
              <MaterialCommunityIcons
                name="view-grid-outline"
                size={18}
                color={gridColumns === 2 ? '#2563EB' : '#64748B'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Enhanced Search & Catalog Dropdown */}
      <BiomarkerSearchDropdown
        catalog={catalog}
        activeMarkers={activeMarkers}
        onSelectMarker={handleSelectMarker}
      />

      {/* Quick Clinical Panel Presets */}
      <View style={styles.presetsBar}>
        <Text style={styles.presetsLabel}>Quick Panels:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => loadPanelPreset('Lipid Panel')}
          >
            <MaterialCommunityIcons name="water-percent" size={14} color="#2563EB" />
            <Text style={styles.presetChipText}>+ Lipid Panel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => loadPanelPreset('Metabolic Panel')}
          >
            <MaterialCommunityIcons name="chart-bell-curve" size={14} color="#059669" />
            <Text style={styles.presetChipText}>+ Metabolic Panel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => loadPanelPreset('Liver Function')}
          >
            <MaterialCommunityIcons name="heart-pulse" size={14} color="#D97706" />
            <Text style={styles.presetChipText}>+ Liver Panel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => loadPanelPreset('Hematology')}
          >
            <MaterialCommunityIcons name="water" size={14} color="#DC2626" />
            <Text style={styles.presetChipText}>+ CBC / Blood</Text>
          </TouchableOpacity>

          {activeMarkers.length > 0 && (
            <TouchableOpacity
              style={[styles.presetChip, styles.clearChip]}
              onPress={() => setActiveMarkers([])}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={14} color="#64748B" />
              <Text style={styles.clearChipText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Active Comparison Bar & Intelligent Ordering Toolbar */}
      {activeMarkers.length > 0 && (
        <View style={styles.controlHeaderCard}>
          <View style={styles.activeChipsHeader}>
            <Text style={styles.activeChipsTitle}>
              Active Comparative Graphs ({activeMarkers.length})
            </Text>
            <Text style={styles.reorderHelpText}>Use ▲ / ▼ buttons on cards to reorganize</Text>
          </View>

          {/* Active Chips */}
          <View style={styles.activeChipsWrapper}>
            {sortedActiveMarkers.map((marker, idx) => (
              <View key={marker} style={styles.activeChip}>
                <Text style={styles.activeChipNumber}>#{idx + 1}</Text>
                <Text style={styles.activeChipName}>{marker}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveMarker(marker)}
                  style={styles.activeChipClose}
                >
                  <MaterialCommunityIcons name="close" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Intelligent Sorting Options */}
          <View style={styles.sortBar}>
            <Text style={styles.sortLabel}>Sort Order:</Text>
            <View style={styles.sortButtonsRow}>
              <TouchableOpacity
                style={[styles.sortBtn, sortMode === 'clinical' && styles.sortBtnActive]}
                onPress={() => setSortMode('clinical')}
              >
                <MaterialCommunityIcons
                  name="stethoscope"
                  size={14}
                  color={sortMode === 'clinical' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={[
                    styles.sortBtnText,
                    sortMode === 'clinical' && styles.sortBtnTextActive,
                  ]}
                >
                  Clinical Panel (Smart)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortBtn, sortMode === 'flagged' && styles.sortBtnActive]}
                onPress={() => setSortMode('flagged')}
              >
                <MaterialCommunityIcons
                  name="alert-outline"
                  size={14}
                  color={sortMode === 'flagged' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={[
                    styles.sortBtnText,
                    sortMode === 'flagged' && styles.sortBtnTextActive,
                  ]}
                >
                  Abnormal First
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sortBtn, sortMode === 'alphabetical' && styles.sortBtnActive]}
                onPress={() => setSortMode('alphabetical')}
              >
                <MaterialCommunityIcons
                  name="sort-alphabetical-ascending"
                  size={14}
                  color={sortMode === 'alphabetical' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={[
                    styles.sortBtnText,
                    sortMode === 'alphabetical' && styles.sortBtnTextActive,
                  ]}
                >
                  Alphabetical
                </Text>
              </TouchableOpacity>

              {sortMode === 'custom' && (
                <View style={[styles.sortBtn, styles.sortBtnActive, { backgroundColor: '#475569' }]}>
                  <MaterialCommunityIcons name="hand-pointing-up" size={14} color="#FFFFFF" />
                  <Text style={[styles.sortBtnText, styles.sortBtnTextActive]}>
                    Custom (Manual)
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Loading state */}
      {isLoadingCatalog && (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading biomarker catalog & history...</Text>
        </View>
      )}

      {/* Empty State when no graphs are selected */}
      {!isLoadingCatalog && activeMarkers.length === 0 && (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="chart-box-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No Graphs Selected</Text>
          <Text style={styles.emptySub}>
            Use the search bar above or click one of the quick panels to start visualizing biomarker trends.
          </Text>
        </View>
      )}

      {/* Graphs List / Grid */}
      <View style={[styles.graphsContainer, gridColumns === 2 && styles.graphsGrid]}>
        {sortedActiveMarkers.map((marker, index) => (
          <View
            key={marker}
            style={[styles.graphWrapper, gridColumns === 2 && styles.graphWrapperHalf]}
          >
            <BiomarkerGraphCard
              markerName={marker}
              index={index}
              totalCards={sortedActiveMarkers.length}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemoveMarker}
            />
          </View>
        ))}
      </View>
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
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
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
    maxWidth: 700,
  },
  layoutToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  layoutBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  layoutBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  presetsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'nowrap',
  },
  presetsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  clearChip: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  clearChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  controlHeaderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  activeChipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  activeChipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reorderHelpText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  activeChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 5,
  },
  activeChipNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
    marginRight: 6,
  },
  activeChipName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E40AF',
    marginRight: 6,
  },
  activeChipClose: {
    padding: 2,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  sortButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    gap: 4,
  },
  sortBtnActive: {
    backgroundColor: '#2563EB',
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
  },
  loadingState: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 500,
  },
  graphsContainer: {
    width: '100%',
  },
  graphsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  graphWrapper: {
    width: '100%',
  },
  graphWrapperHalf: {
    width: '49%',
  },
});
