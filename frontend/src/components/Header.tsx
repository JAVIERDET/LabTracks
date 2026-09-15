import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type TabType = 'upload' | 'trends' | 'archive';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="water" size={24} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.title}>LabTrack</Text>
          <Text style={styles.subtitle}>Blood Biomarker Intelligence & Trend Tracking</Text>
        </View>
      </View>

      <View style={styles.navTabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'upload' && styles.activeTabButton]}
          onPress={() => onTabChange('upload')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="cloud-upload-outline"
            size={18}
            color={activeTab === 'upload' ? '#2563EB' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'upload' && styles.activeTabText]}>
            Upload Lab
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'trends' && styles.activeTabButton]}
          onPress={() => onTabChange('trends')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="chart-line"
            size={18}
            color={activeTab === 'trends' ? '#2563EB' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'trends' && styles.activeTabText]}>
            Biomarker Trends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'archive' && styles.activeTabButton]}
          onPress={() => onTabChange('archive')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="folder-open-outline"
            size={18}
            color={activeTab === 'archive' ? '#2563EB' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'archive' && styles.activeTabText]}>
            Document Archive
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  navTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
    alignSelf: 'flex-start',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#2563EB',
    fontWeight: '600',
  },
});

