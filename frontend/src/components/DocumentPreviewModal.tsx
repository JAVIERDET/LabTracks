import React from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLabFileUrl } from '../services/api';
import { LabDocumentResponse } from '../types';

interface DocumentPreviewModalProps {
  visible: boolean;
  doc: LabDocumentResponse | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  visible,
  doc,
  onClose,
}) => {
  if (!doc) return null;

  const fileUrl = getLabFileUrl(doc.id, false);
  const downloadUrl = getLabFileUrl(doc.id, true);
  const isPdf = doc.mime_type === 'application/pdf' || doc.filename.toLowerCase().endsWith('.pdf');

  const openInNewTab = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(fileUrl, '_blank');
    }
  };

  const triggerDownload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleWrapper}>
              <MaterialCommunityIcons
                name={isPdf ? 'file-pdf-box' : 'file-image'}
                size={24}
                color={isPdf ? '#DC2626' : '#2563EB'}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.title} numberOfLines={1}>
                {doc.filename}
              </Text>
            </View>

            <View style={styles.headerActions}>
              {Platform.OS === 'web' && (
                <>
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={openInNewTab}
                  >
                    <MaterialCommunityIcons name="open-in-new" size={20} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconButton}
                    onPress={triggerDownload}
                  >
                    <MaterialCommunityIcons name="download" size={20} color="#64748B" />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <MaterialCommunityIcons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Metadata bar */}
          <View style={styles.metaBar}>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Test Date: </Text>
              {doc.test_date || 'Needs Verification'}
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Biomarkers: </Text>
              {doc.biomarkers.length} extracted
            </Text>
            <Text style={styles.metaItem}>
              <Text style={styles.metaLabel}>Size: </Text>
              {(doc.file_size / 1024).toFixed(1)} KB
            </Text>
          </View>

          {/* Content Preview */}
          <View style={styles.previewContainer}>
            {Platform.OS === 'web' && isPdf ? (
              <iframe
                src={fileUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  borderRadius: 8,
                }}
                title="Document Preview"
              />
            ) : !isPdf ? (
              <ScrollView
                contentContainerStyle={styles.imageScroll}
                maximumZoomScale={3}
                minimumZoomScale={1}
              >
                <Image
                  source={{ uri: fileUrl }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : (
              <View style={styles.mobilePdfPlaceholder}>
                <MaterialCommunityIcons name="file-pdf-box" size={64} color="#DC2626" />
                <Text style={styles.mobilePdfText}>PDF document ready</Text>
                <TouchableOpacity style={styles.mobileOpenButton} onPress={openInNewTab}>
                  <Text style={styles.mobileOpenButtonText}>View Full Document</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Extracted Biomarkers Drawer */}
          <View style={styles.biomarkersSection}>
            <Text style={styles.biomarkersTitle}>
              Extracted Biomarkers ({doc.biomarkers.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
              {doc.biomarkers.map((b, idx) => {
                const isHigh = b.flag === 'H';
                const isLow = b.flag === 'L';
                return (
                  <View
                    key={`${b.name}-${idx}`}
                    style={[
                      styles.biomarkerTag,
                      isHigh && styles.tagHigh,
                      isLow && styles.tagLow,
                    ]}
                  >
                    <Text style={styles.tagName}>{b.name}:</Text>
                    <Text style={[styles.tagValue, (isHigh || isLow) && styles.tagValueAlert]}>
                      {b.value} {b.unit}
                    </Text>
                    {b.flag && (
                      <Text style={[styles.tagFlag, isHigh ? styles.flagHighText : styles.flagLowText]}>
                        [{b.flag}]
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 900,
    height: '88%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  closeButton: {
    padding: 6,
  },
  metaBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 20,
  },
  metaItem: {
    fontSize: 12,
    color: '#334155',
  },
  metaLabel: {
    fontWeight: '600',
    color: '#64748B',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 8,
  },
  imageScroll: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    minHeight: 350,
  },
  mobilePdfPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mobilePdfText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
    marginBottom: 16,
  },
  mobileOpenButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  mobileOpenButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  biomarkersSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  biomarkersTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tagScroll: {
    flexDirection: 'row',
  },
  biomarkerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tagHigh: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  tagLow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  tagName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 4,
  },
  tagValue: {
    fontSize: 12,
    color: '#475569',
  },
  tagValueAlert: {
    fontWeight: '700',
    color: '#0F172A',
  },
  tagFlag: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  flagHighText: {
    color: '#DC2626',
  },
  flagLowText: {
    color: '#D97706',
  },
});
