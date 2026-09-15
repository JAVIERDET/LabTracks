import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateModal } from '../components/DateModal';
import { Dropzone } from '../components/Dropzone';
import { DuplicateModal } from '../components/DuplicateModal';
import {
  UploadFileParam,
  updateLabDate,
  uploadLabDocument,
} from '../services/api';
import { LabDocumentResponse } from '../types';

interface UploadScreenProps {
  onNavigateToTrends: (biomarkerName?: string) => void;
  existingFilenames: string[];
  onUploadSuccess: () => void;
}

export const UploadScreen: React.FC<UploadScreenProps> = ({
  onNavigateToTrends,
  existingFilenames,
  onUploadSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<UploadFileParam | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUploadedDoc, setLastUploadedDoc] = useState<LabDocumentResponse | null>(null);

  // Modal states
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState<UploadFileParam | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [docNeedingDate, setDocNeedingDate] = useState<LabDocumentResponse | null>(null);

  const handleFileSelect = (fileParam: UploadFileParam) => {
    setSelectedFile(fileParam);

    // Check if filename already exists in user's records
    const isDuplicate = existingFilenames.some(
      (fn) => fn.toLowerCase() === fileParam.name.toLowerCase()
    );

    if (isDuplicate) {
      setPendingFile(fileParam);
      setDuplicateModalVisible(true);
    } else {
      processUpload(fileParam, false);
    }
  };

  const processUpload = async (fileParam: UploadFileParam, reUpload: boolean) => {
    try {
      setIsLoading(true);
      const doc = await uploadLabDocument(fileParam, reUpload);
      setLastUploadedDoc(doc);
      onUploadSuccess();

      // Check if test date is missing
      if (doc.requires_manual_date || !doc.test_date) {
        setDocNeedingDate(doc);
        setDateModalVisible(true);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to upload and extract document';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Upload Error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRescan = () => {
    setDuplicateModalVisible(false);
    if (pendingFile) {
      processUpload(pendingFile, true);
    }
  };

  const handleUseCached = () => {
    setDuplicateModalVisible(false);
    if (pendingFile) {
      // re_upload = false returns cached document
      processUpload(pendingFile, false);
    }
  };

  const handleSaveManualDate = async (testDate: string) => {
    if (!docNeedingDate) return;
    const updated = await updateLabDate(docNeedingDate.id, testDate);
    setLastUploadedDoc(updated);
    setDateModalVisible(false);
    setDocNeedingDate(null);
    onUploadSuccess();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Upload Blood Test Report</Text>
        <Text style={styles.heroDescription}>
          LabTrack uses Gemini AI to extract biomarkers, units, reference intervals, and flags.
          Upload your PDF reports or photos below.
        </Text>
      </View>

      <Dropzone
        onFileSelect={handleFileSelect}
        isLoading={isLoading}
        selectedFile={selectedFile}
        onClear={() => {
          setSelectedFile(null);
          setLastUploadedDoc(null);
        }}
      />

      {/* Extracted Results View */}
      {lastUploadedDoc && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsTitle}>Extraction Results</Text>
              <Text style={styles.resultsDocName}>{lastUploadedDoc.filename}</Text>
            </View>
            <View style={styles.dateBadge}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={lastUploadedDoc.test_date ? '#16A34A' : '#D97706'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.dateBadgeText,
                  !lastUploadedDoc.test_date && styles.dateBadgeTextAlert,
                ]}
              >
                {lastUploadedDoc.test_date || 'Date Missing'}
              </Text>
            </View>
          </View>

          {lastUploadedDoc.requires_manual_date && (
            <TouchableOpacity
              style={styles.missingDateAlert}
              onPress={() => {
                setDocNeedingDate(lastUploadedDoc);
                setDateModalVisible(true);
              }}
            >
              <MaterialCommunityIcons name="alert-outline" size={18} color="#D97706" />
              <Text style={styles.missingDateAlertText}>
                No test date detected. Tap here to enter date manually.
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.tableHeaderCount}>
            {lastUploadedDoc.biomarkers.length} Biomarkers Identified
          </Text>

          {/* Biomarkers Table */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Biomarker</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Result</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Flag</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: 'center' }]}>Reference</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'right' }]}>Trend</Text>
            </View>

            {lastUploadedDoc.biomarkers.map((b, idx) => {
              const isHigh = b.flag === 'H';
              const isLow = b.flag === 'L';
              return (
                <View
                  key={`${b.name}-${idx}`}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.markerName}>{b.name}</Text>
                    {b.category && <Text style={styles.markerCat}>{b.category}</Text>}
                  </View>

                  <Text style={[styles.markerValue, { flex: 1.2, textAlign: 'center' }]}>
                    {b.value} <Text style={styles.markerUnit}>{b.unit}</Text>
                  </Text>

                  <View style={{ flex: 0.8, alignItems: 'center' }}>
                    <View
                      style={[
                        styles.flagPill,
                        isHigh && styles.flagHigh,
                        isLow && styles.flagLow,
                        !isHigh && !isLow && styles.flagNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.flagPillText,
                          isHigh && styles.flagHighText,
                          isLow && styles.flagLowText,
                          !isHigh && !isLow && styles.flagNormalText,
                        ]}
                      >
                        {b.flag || 'Normal'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.markerRef, { flex: 1.5, textAlign: 'center' }]}>
                    {b.reference_range_raw ||
                      (b.ref_min !== null || b.ref_max !== null
                        ? `${b.ref_min ?? ''} - ${b.ref_max ?? ''}`
                        : '-')}
                  </Text>

                  <TouchableOpacity
                    style={{ flex: 0.8, alignItems: 'flex-end' }}
                    onPress={() => onNavigateToTrends(b.name)}
                  >
                    <MaterialCommunityIcons name="chart-line" size={20} color="#2563EB" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Modals */}
      <DuplicateModal
        visible={duplicateModalVisible}
        filename={pendingFile?.name || ''}
        onConfirmRescan={handleConfirmRescan}
        onUseCached={handleUseCached}
      />

      <DateModal
        visible={dateModalVisible}
        filename={docNeedingDate?.filename || ''}
        onSaveDate={handleSaveManualDate}
        onClose={() => setDateModalVisible(false)}
      />
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
  heroSection: {
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  heroDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  resultsCard: {
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
    marginTop: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultsDocName: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  dateBadgeTextAlert: {
    color: '#D97706',
  },
  missingDateAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  missingDateAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
    marginLeft: 8,
  },
  tableHeaderCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  markerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  markerCat: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  markerValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  markerUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  flagPill: {
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
  flagPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  flagHighText: {
    color: '#DC2626',
  },
  flagLowText: {
    color: '#D97706',
  },
  flagNormalText: {
    color: '#16A34A',
  },
  markerRef: {
    fontSize: 12,
    color: '#64748B',
  },
});

