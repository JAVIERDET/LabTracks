import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DateModalProps {
  visible: boolean;
  filename: string;
  onSaveDate: (testDate: string) => Promise<void>;
  onClose?: () => void;
}

export const DateModal: React.FC<DateModalProps> = ({
  visible,
  filename,
  onSaveDate,
  onClose,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    // Validate YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(selectedDate)) {
      setError('Please enter date in format YYYY-MM-DD');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSaveDate(selectedDate);
    } catch (err: any) {
      setError(err.message || 'Failed to update date');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="calendar-alert" size={32} color="#2563EB" />
          </View>

          <Text style={styles.title}>Test Date Required</Text>
          <Text style={styles.message}>
            No collection or test date could be detected automatically in{' '}
            <Text style={styles.filenameHighlight}>{filename}</Text>.
          </Text>
          <Text style={styles.subtext}>
            Please enter the test date to ensure chronological accuracy on your biomarker charts.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Test Date (YYYY-MM-DD)</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons
                name="calendar"
                size={20}
                color="#64748B"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.textInput}
                value={selectedDate}
                onChangeText={(text) => {
                  setSelectedDate(text);
                  if (error) setError(null);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                maxLength={10}
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.buttonRow}>
            {onClose && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.saveButtonText}>Confirm Date</Text>
                </>
              )}
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
    backgroundColor: '#DBEAFE',
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
  subtext: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 18,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

