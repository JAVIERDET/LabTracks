import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DuplicateModalProps {
  visible: boolean;
  filename: string;
  onConfirmRescan: () => void;
  onUseCached: () => void;
}

export const DuplicateModal: React.FC<DuplicateModalProps> = ({
  visible,
  filename,
  onConfirmRescan,
  onUseCached,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#D97706" />
          </View>

          <Text style={styles.title}>File Already Processed</Text>
          <Text style={styles.message}>
            A lab document named <Text style={styles.filenameHighlight}>{filename}</Text> already
            exists in your records.
          </Text>
          <Text style={styles.question}>
            This file has already been processed. Re-scan with AI?
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cachedButton} onPress={onUseCached} activeOpacity={0.8}>
              <Text style={styles.cachedButtonText}>Use Cached Record</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.rescanButton} onPress={onConfirmRescan} activeOpacity={0.8}>
              <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.rescanButtonText}>Re-scan with AI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  filenameHighlight: {
    fontWeight: '600',
    color: '#0F172A',
  },
  question: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
    marginVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  cachedButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cachedButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  rescanButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  rescanButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

