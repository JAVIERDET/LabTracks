import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AddBiomarkerModal } from '../components/AddBiomarkerModal';
import { DateModal } from '../components/DateModal';
import { Dropzone } from '../components/Dropzone';
import { DuplicateModal } from '../components/DuplicateModal';
import {
  UploadFileParam,
  addBiomarkerToLab,
  deleteLabBiomarker,
  updateLabBiomarker,
  updateLabDate,
  uploadLabDocument,
} from '../services/api';
import { BiomarkerInput, BiomarkerResult, LabDocumentResponse, UploadQueueItem } from '../types';

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

  // Batch queue state
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  // Modal states
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [pendingFile, setPendingFile] = useState<UploadFileParam | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [docNeedingDate, setDocNeedingDate] = useState<LabDocumentResponse | null>(null);

  // Biomarker CRUD modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingBiomarker, setEditingBiomarker] = useState<BiomarkerResult | null>(null);

  // Sequential batch processing
  const handleFilesSelect = async (files: UploadFileParam[]) => {
    if (!files.length) return;

    if (files.length === 1) {
      const file = files[0];
      setSelectedFile(file);
      const isDuplicate = existingFilenames.some(
        (fn) => fn.toLowerCase() === file.name.toLowerCase()
      );
      if (isDuplicate) {
        setPendingFile(file);
        setDuplicateModalVisible(true);
        return;
      }
    }

    const newQueue: UploadQueueItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      status: 'queued',
    }));

    setQueue(newQueue);
    await processBatchQueue(newQueue);
  };

  const processBatchQueue = async (items: UploadQueueItem[]) => {
    setIsLoading(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setSelectedFile(item.file);

      // Set item to uploading
      setQueue((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it))
      );

      try {
        const doc = await uploadLabDocument(item.file, false);
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'completed', result: doc } : it
          )
        );
        setLastUploadedDoc(doc);
        onUploadSuccess();

        // If date missing, mark for date modal
        if (doc.requires_manual_date || !doc.test_date) {
          setDocNeedingDate(doc);
          setDateModalVisible(true);
        }
      } catch (err: any) {
        const errMsg = err.message || 'Extraction failed';
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: 'failed', error: errMsg } : it
          )
        );
      }
    }

    setIsLoading(false);
  };

  const processSingleUpload = async (fileParam: UploadFileParam, reUpload: boolean) => {
    try {
      setIsLoading(true);
      const doc = await uploadLabDocument(fileParam, reUpload);
      setLastUploadedDoc(doc);
      onUploadSuccess();

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
      processSingleUpload(pendingFile, true);
    }
  };

  const handleUseCached = () => {
    setDuplicateModalVisible(false);
    if (pendingFile) {
      processSingleUpload(pendingFile, false);
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

  // Biomarker CRUD operations
  const handleSaveBiomarker = async (input: BiomarkerInput) => {
    if (!lastUploadedDoc) return;
    if (editingBiomarker && editingBiomarker.id) {
      const updated = await updateLabBiomarker(
        lastUploadedDoc.id,
        editingBiomarker.id,
        input
      );
      setLastUploadedDoc((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          biomarkers: prev.biomarkers.map((b) =>
            b.id === updated.id ? updated : b
          ),
        };
      });
    } else {
      const created = await addBiomarkerToLab(lastUploadedDoc.id, input);
      setLastUploadedDoc((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          biomarkers: [...prev.biomarkers, created],
        };
      });
    }
    onUploadSuccess();
  };

  const handleDeleteBiomarker = async (biomarker: BiomarkerResult) => {
    if (!lastUploadedDoc || !biomarker.id) return;

    const doDelete = async () => {
      try {
        await deleteLabBiomarker(lastUploadedDoc.id, biomarker.id!);
        setLastUploadedDoc((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            biomarkers: prev.biomarkers.filter((b) => b.id !== biomarker.id),
          };
        });
        onUploadSuccess();
      } catch (err: any) {
        const msg = err.message || 'Failed to delete parameter';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete parameter "${biomarker.name}" from this report?`)) {
        await doDelete();
      }
    } else {
      Alert.alert(
        'Delete Parameter',
        `Are you sure you want to remove "${biomarker.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const completedCount = queue.filter((q) => q.status === 'completed').length;
  const processedCount = queue.filter(
    (q) => q.status === 'completed' || q.status === 'failed'
  ).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Upload Blood Test Reports</Text>
        <Text style={styles.heroDescription}>
          Select or drop single or multiple lab reports (PDF or images). LabTrack reads and
          extracts parameters sequentially one by one using clinical AI rules.
        </Text>
      </View>

      <Dropzone
        onFilesSelect={handleFilesSelect}
        onFileSelect={(f) => handleFilesSelect([f])}
        isLoading={isLoading}
        selectedFile={selectedFile}
        selectedFilesCount={queue.length}
        onClear={() => {
          setSelectedFile(null);
          setLastUploadedDoc(null);
          setQueue([]);
        }}
      />

      {/* Batch Processing Queue UI */}
      {queue.length > 0 && (
        <View style={styles.queueCard}>
          <View style={styles.queueHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.queueTitle}>Batch Processing Queue</Text>
              <Text style={styles.queueSubtitle}>
                Sequential reading: {completedCount} of {queue.length} reports extracted
              </Text>
            </View>
            {isLoading && (
              <View style={styles.queueBadgeActive}>
                <ActivityIndicator size="small" color="#2563EB" style={{ marginRight: 6 }} />
                <Text style={styles.queueBadgeText}>Scanning...</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(processedCount / queue.length) * 100}%` },
              ]}
            />
          </View>

          {/* Items */}
          <View style={styles.queueList}>
            {queue.map((item) => {
              const isSelected = lastUploadedDoc?.id === item.result?.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.queueItemRow,
                    item.result && styles.queueItemClickable,
                    isSelected && styles.queueItemActive,
                  ]}
                  onPress={() => {
                    if (item.result) {
                      setLastUploadedDoc(item.result);
                      setSelectedFile(item.file);
                    }
                  }}
                  disabled={!item.result}
                >
                  <View style={styles.queueStatusIcon}>
                    {item.status === 'queued' && (
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={20}
                        color="#94A3B8"
                      />
                    )}
                    {item.status === 'uploading' && (
                      <ActivityIndicator size="small" color="#2563EB" />
                    )}
                    {item.status === 'completed' && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color="#16A34A"
                      />
                    )}
                    {item.status === 'failed' && (
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={20}
                        color="#DC2626"
                      />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.queueFileName} numberOfLines={1}>
                      {item.file.name}
                    </Text>
                    <Text style={styles.queueItemDetail}>
                      {item.status === 'queued' && 'Queued for reading'}
                      {item.status === 'uploading' && 'Extracting biomarkers & values...'}
                      {item.status === 'completed' &&
                        `${item.result?.biomarkers.length || 0} biomarkers identified`}
                      {item.status === 'failed' && (item.error || 'Extraction failed')}
                    </Text>
                  </View>

                  {item.result && (
                    <MaterialCommunityIcons
                      name={isSelected ? 'eye' : 'chevron-right'}
                      size={18}
                      color={isSelected ? '#2563EB' : '#94A3B8'}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Extracted Results View */}
      {lastUploadedDoc && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <View style={{ flex: 1, marginRight: 10 }}>
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

          {/* Table Header Bar with Add Parameter Button */}
          <View style={styles.tableHeaderBar}>
            <Text style={styles.tableHeaderCount}>
              {lastUploadedDoc.biomarkers.length} Biomarkers Identified
            </Text>
            <TouchableOpacity
              style={styles.addParamBtn}
              onPress={() => {
                setEditingBiomarker(null);
                setAddModalVisible(true);
              }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addParamBtnText}>Add Parameter</Text>
            </TouchableOpacity>
          </View>

          {/* Biomarkers Table */}
          <View style={styles.tableContainer}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Biomarker</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Result</Text>
              <Text style={[styles.th, { flex: 0.8, textAlign: 'center' }]}>Flag</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'center' }]}>Reference</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Actions</Text>
            </View>

            {lastUploadedDoc.biomarkers.map((b, idx) => {
              const isHigh = b.flag === 'H';
              const isLow = b.flag === 'L';
              return (
                <View
                  key={`${b.name}-${b.id || idx}`}
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

                  <Text style={[styles.markerRef, { flex: 1.2, textAlign: 'center' }]}>
                    {b.reference_range_raw ||
                      (b.ref_min !== null || b.ref_max !== null
                        ? `${b.ref_min ?? ''} - ${b.ref_max ?? ''}`
                        : '-')}
                  </Text>

                  <View
                    style={[
                      styles.rowActions,
                      { flex: 1.2, justifyContent: 'flex-end' },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => onNavigateToTrends(b.name)}
                    >
                      <MaterialCommunityIcons
                        name="chart-line"
                        size={18}
                        color="#2563EB"
                      />
                    </TouchableOpacity>

                    {b.id && (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => {
                          setEditingBiomarker(b);
                          setAddModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons
                          name="pencil-outline"
                          size={18}
                          color="#64748B"
                        />
                      </TouchableOpacity>
                    )}

                    {b.id && (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => handleDeleteBiomarker(b)}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color="#DC2626"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
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

      <AddBiomarkerModal
        visible={addModalVisible}
        initialData={editingBiomarker}
        onClose={() => {
          setAddModalVisible(false);
          setEditingBiomarker(null);
        }}
        onSave={handleSaveBiomarker}
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
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  queueSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  queueBadgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  queueList: {
    gap: 8,
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  queueItemClickable: {
    cursor: 'pointer' as any,
  },
  queueItemActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  queueStatusIcon: {
    width: 24,
    alignItems: 'center',
  },
  queueFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  queueItemDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
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
  tableHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableHeaderCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  addParamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addParamBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    paddingVertical: 10,
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 4,
  },
});
