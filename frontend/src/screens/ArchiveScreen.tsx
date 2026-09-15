import React, { useEffect, useState } from 'react';
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
import { DateModal } from '../components/DateModal';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import {
  deleteLabDocument,
  getLabDocument,
  getLabFileUrl,
  listLabDocuments,
  updateLabDate,
} from '../services/api';
import { LabDocumentResponse, LabDocumentSummary } from '../types';

interface ArchiveScreenProps {
  onSelectBiomarker: (markerName: string) => void;
  refreshTrigger: number;
}

export const ArchiveScreen: React.FC<ArchiveScreenProps> = ({
  onSelectBiomarker,
  refreshTrigger,
}) => {
  const [documents, setDocuments] = useState<LabDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<LabDocumentResponse | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Edit date modal
  const [editDateModalVisible, setEditDateModalVisible] = useState(false);
  const [docToEditDate, setDocToEditDate] = useState<LabDocumentSummary | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await listLabDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const fullDoc = await getLabDocument(id);
      setSelectedDoc(fullDoc);
      setPreviewVisible(true);
    } catch (err) {
      console.error('Failed to load doc for preview:', err);
    }
  };

  const handleDownload = (id: number) => {
    const url = getLabFileUrl(id, true);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Are you sure you want to delete this lab document?')
        : true;

    if (confirmed) {
      try {
        await deleteLabDocument(id);
        setDocuments((prev) => prev.filter((d) => d.id !== id));
      } catch (err) {
        console.error('Failed to delete document:', err);
      }
    }
  };

  const handleSaveDate = async (testDate: string) => {
    if (!docToEditDate) return;
    await updateLabDate(docToEditDate.id, testDate);
    setEditDateModalVisible(false);
    setDocToEditDate(null);
    loadDocuments();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>Document Archive</Text>
        <Text style={styles.subtitle}>
          Secure archive of your original lab test documents, detected biomarker counts, and dates.
        </Text>
      </View>

      {isLoading && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loaderText}>Loading archive...</Text>
        </View>
      )}

      {!isLoading && documents.length === 0 && (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="folder-open-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No documents uploaded yet</Text>
          <Text style={styles.emptySubtitle}>
            Uploaded blood test reports and images will appear here with full preview and download access.
          </Text>
        </View>
      )}

      {!isLoading && documents.length > 0 && (
        <View style={styles.docList}>
          {documents.map((doc) => {
            const isPdf =
              doc.mime_type === 'application/pdf' ||
              doc.filename.toLowerCase().endsWith('.pdf');
            const hasDate = Boolean(doc.test_date);

            return (
              <View key={doc.id} style={styles.docCard}>
                <View style={styles.docCardMain}>
                  <View
                    style={[
                      styles.fileIconBox,
                      isPdf ? styles.iconPdf : styles.iconImg,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isPdf ? 'file-pdf-box' : 'file-image'}
                      size={28}
                      color={isPdf ? '#DC2626' : '#2563EB'}
                    />
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docFilename} numberOfLines={1}>
                      {doc.filename}
                    </Text>

                    <View style={styles.metaRow}>
                      <View style={styles.metaBadge}>
                        <MaterialCommunityIcons
                          name="calendar"
                          size={12}
                          color={hasDate ? '#16A34A' : '#D97706'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.metaBadgeText,
                            !hasDate && styles.metaBadgeTextAlert,
                          ]}
                        >
                          {doc.test_date || 'Needs Date'}
                        </Text>
                      </View>

                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>
                        {doc.biomarkers_count} biomarker{doc.biomarkers_count !== 1 ? 's' : ''}
                      </Text>

                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>
                        {(doc.file_size / 1024).toFixed(1)} KB
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  {!hasDate && (
                    <TouchableOpacity
                      style={styles.editDateBtn}
                      onPress={() => {
                        setDocToEditDate(doc);
                        setEditDateModalVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="calendar-edit" size={16} color="#D97706" />
                      <Text style={styles.editDateBtnText}>Set Date</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionBtnPrimary}
                    onPress={() => handlePreview(doc.id)}
                  >
                    <MaterialCommunityIcons name="eye-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.actionBtnPrimaryText}>Preview</Text>
                  </TouchableOpacity>

                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => handleDownload(doc.id)}
                    >
                      <MaterialCommunityIcons name="download" size={16} color="#475569" />
                      <Text style={styles.actionBtnSecondaryText}>Download</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(doc.id)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Preview Modal */}
      <DocumentPreviewModal
        visible={previewVisible}
        doc={selectedDoc}
        onClose={() => {
          setPreviewVisible(false);
          setSelectedDoc(null);
        }}
        onBiomarkerChange={loadDocuments}
      />

      {/* Edit Date Modal */}
      <DateModal
        visible={editDateModalVisible}
        filename={docToEditDate?.filename || ''}
        onSaveDate={handleSaveDate}
        onClose={() => {
          setEditDateModalVisible(false);
          setDocToEditDate(null);
        }}
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
  titleSection: {
    marginBottom: 24,
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
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 20,
  },
  docList: {
    gap: 14,
  },
  docCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  docCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  iconPdf: {
    backgroundColor: '#FEE2E2',
  },
  iconImg: {
    backgroundColor: '#EFF6FF',
  },
  docInfo: {
    flex: 1,
  },
  docFilename: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  metaBadgeTextAlert: {
    color: '#D97706',
  },
  metaDot: {
    color: '#CBD5E1',
    marginHorizontal: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 8,
  },
  editDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 'auto',
  },
  editDateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    marginLeft: 4,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionBtnSecondaryText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  deleteBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
});
