import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { detectClinicalPanel } from '../services/unitConverter';
import { BiomarkerCatalogItem } from '../types';

interface BiomarkerSearchDropdownProps {
  catalog: BiomarkerCatalogItem[];
  activeMarkers: string[];
  onSelectMarker: (markerName: string) => void;
  placeholder?: string;
}

const CATEGORY_FILTERS = [
  'All',
  'Lipid Panel',
  'Metabolic Panel',
  'Liver Function',
  'Kidney Function',
  'Hematology',
  'Electrolytes',
  'Thyroid',
  'Cardiovascular & Inflammation',
  'Vitamins',
];

export const BiomarkerSearchDropdown: React.FC<BiomarkerSearchDropdownProps> = ({
  catalog,
  activeMarkers,
  onSelectMarker,
  placeholder = 'Search or select biomarker to compare...',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Filtered and prioritized catalog
  const filteredItems = useMemo(() => {
    let list = catalog;

    // Filter by category if not 'All'
    if (selectedCategory !== 'All') {
      list = list.filter(
        (item) =>
          detectClinicalPanel(item.name) === selectedCategory ||
          (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()))
      );
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      // Sort alphabetically
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Prefix matches come first, then substring matches
    const prefixMatches: BiomarkerCatalogItem[] = [];
    const substringMatches: BiomarkerCatalogItem[] = [];

    for (const item of list) {
      const lower = item.name.toLowerCase();
      if (lower.startsWith(query)) {
        prefixMatches.push(item);
      } else if (lower.includes(query)) {
        substringMatches.push(item);
      }
    }

    prefixMatches.sort((a, b) => a.name.localeCompare(b.name));
    substringMatches.sort((a, b) => a.name.localeCompare(b.name));

    return [...prefixMatches, ...substringMatches];
  }, [catalog, searchQuery, selectedCategory]);

  const handleSelectItem = (item: BiomarkerCatalogItem) => {
    onSelectMarker(item.name);
    setSearchQuery('');
    setIsOpen(false);
  };

  // Highlight matching characters
  const renderHighlightedName = (name: string, query: string) => {
    if (!query) {
      return <Text style={styles.itemNameText}>{name}</Text>;
    }
    const idx = name.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) {
      return <Text style={styles.itemNameText}>{name}</Text>;
    }

    const before = name.substring(0, idx);
    const match = name.substring(idx, idx + query.length);
    const after = name.substring(idx + query.length);

    return (
      <Text style={styles.itemNameText}>
        {before}
        <Text style={styles.highlightText}>{match}</Text>
        {after}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={[styles.searchBar, isOpen && styles.searchBarActive]}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={isOpen ? '#2563EB' : '#64748B'}
          style={{ marginRight: 8 }}
        />

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />

        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setSearchQuery('')}
          >
            <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Dropdown toggle chevron */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setIsOpen(!isOpen)}
        >
          <MaterialCommunityIcons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#475569"
          />
        </TouchableOpacity>
      </View>

      {/* Full Scrollable Catalog Dropdown */}
      {isOpen && (
        <View style={styles.dropdownCard}>
          {/* Header with count and filter chips */}
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>
              Available Parameters ({filteredItems.length} of {catalog.length})
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
            >
              {CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catFilterChip, isSelected && styles.catFilterChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.catFilterText,
                        isSelected && styles.catFilterTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Scrollable list of all matching parameters */}
          <ScrollView
            style={styles.itemsScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="text-search"
                  size={32}
                  color="#94A3B8"
                  style={{ marginBottom: 6 }}
                />
                <Text style={styles.emptyStateText}>
                  No parameters match "{searchQuery}"
                </Text>
                <Text style={styles.emptyStateSub}>
                  Try another search or upload a test report containing this parameter.
                </Text>
              </View>
            ) : (
              filteredItems.map((item, idx) => {
                const isAlreadyActive = activeMarkers.includes(item.name);
                const panel = detectClinicalPanel(item.name);
                const isAbnormal = item.latest_flag === 'H' || item.latest_flag === 'L';

                return (
                  <TouchableOpacity
                    key={`${item.name}-${idx}`}
                    style={[
                      styles.itemRow,
                      isAlreadyActive && styles.itemRowActive,
                      idx % 2 === 1 && styles.itemRowAlt,
                    ]}
                    onPress={() => handleSelectItem(item)}
                  >
                    <View style={styles.itemMain}>
                      <View style={styles.itemNameRow}>
                        {renderHighlightedName(item.name, searchQuery)}
                        {isAlreadyActive && (
                          <View style={styles.activePill}>
                            <MaterialCommunityIcons name="check" size={12} color="#2563EB" />
                            <Text style={styles.activePillText}>In View</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.itemMetaRow}>
                        <View style={styles.panelBadge}>
                          <Text style={styles.panelBadgeText}>{panel}</Text>
                        </View>
                        <Text style={styles.itemCountText}>
                          {item.count} test{item.count > 1 ? 's' : ''}
                        </Text>
                        {item.latest_date && (
                          <Text style={styles.itemDateText}>
                            Latest: {item.latest_date}
                          </Text>
                        )}
                      </View>
                    </View>

                    {item.latest_value !== null && item.latest_value !== undefined && (
                      <View style={styles.itemValueCol}>
                        <Text style={styles.itemValueText}>
                          {item.latest_value}{' '}
                          <Text style={styles.itemUnitText}>{item.latest_unit}</Text>
                        </Text>
                        {item.latest_flag && (
                          <View
                            style={[
                              styles.flagBadge,
                              item.latest_flag === 'H' && styles.flagH,
                              item.latest_flag === 'L' && styles.flagL,
                              !isAbnormal && styles.flagNormal,
                            ]}
                          >
                            <Text
                              style={[
                                styles.flagText,
                                item.latest_flag === 'H' && styles.flagTextH,
                                item.latest_flag === 'L' && styles.flagTextL,
                                !isAbnormal && styles.flagTextNormal,
                              ]}
                            >
                              {item.latest_flag}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    <MaterialCommunityIcons
                      name={isAlreadyActive ? 'check-circle' : 'plus-circle-outline'}
                      size={20}
                      color={isAlreadyActive ? '#2563EB' : '#94A3B8'}
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Dropdown footer dismiss button */}
          <View style={styles.dropdownFooter}>
            <TouchableOpacity
              style={styles.closeDropdownBtn}
              onPress={() => setIsOpen(false)}
            >
              <Text style={styles.closeDropdownBtnText}>Close Catalog</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchBarActive: {
    borderColor: '#2563EB',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  iconBtn: {
    padding: 6,
  },
  dropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownHeader: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  dropdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  catFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catFilterChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  catFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  catFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  itemsScroll: {
    maxHeight: 320,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemRowAlt: {
    backgroundColor: '#FAFAFA',
  },
  itemRowActive: {
    backgroundColor: '#EFF6FF',
  },
  itemMain: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  highlightText: {
    color: '#2563EB',
    fontWeight: '800',
    backgroundColor: '#DBEAFE',
    borderRadius: 3,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 2,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  panelBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  panelBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  itemCountText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemValueCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  itemValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemUnitText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#64748B',
  },
  flagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
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
  flagText: {
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
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  dropdownFooter: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    alignItems: 'flex-end',
  },
  closeDropdownBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  closeDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
});
