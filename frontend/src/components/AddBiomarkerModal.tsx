import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BiomarkerInput, BiomarkerResult } from '../types';

interface AddBiomarkerModalProps {
  visible: boolean;
  initialData?: BiomarkerResult | null;
  onClose: () => void;
  onSave: (biomarker: BiomarkerInput) => Promise<void>;
}

const COMMON_UNITS = [
  'mg/dL',
  'mmol/L',
  'µmol/L',
  'g/dL',
  'g/L',
  'U/L',
  'IU/L',
  'µg/dL',
  'ng/mL',
  'pg/mL',
  'pmol/L',
  '%',
  'cells/µL',
  '10^3/µL',
  '10^6/µL',
];

const COMMON_CATEGORIES = [
  'Lipid Panel',
  'Metabolic',
  'Liver Function',
  'Kidney Function',
  'Electrolytes',
  'Hematology',
  'Thyroid',
  'Vitamins',
  'Cardiovascular',
  'Other',
];

export const AddBiomarkerModal: React.FC<AddBiomarkerModalProps> = ({
  visible,
  initialData,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [unit, setUnit] = useState('mg/dL');
  const [refMinStr, setRefMinStr] = useState('');
  const [refMaxStr, setRefMaxStr] = useState('');
  const [referenceRangeRaw, setReferenceRangeRaw] = useState('');
  const [category, setCategory] = useState('Metabolic');
  const [flag, setFlag] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setValueStr(initialData.value !== undefined ? String(initialData.value) : '');
      setUnit(initialData.unit || 'mg/dL');
      setRefMinStr(initialData.ref_min !== null && initialData.ref_min !== undefined ? String(initialData.ref_min) : '');
      setRefMaxStr(initialData.ref_max !== null && initialData.ref_max !== undefined ? String(initialData.ref_max) : '');
      setReferenceRangeRaw(initialData.reference_range_raw || '');
      setCategory(initialData.category || 'Other');
      setFlag(initialData.flag || null);
    } else {
      setName('');
      setValueStr('');
      setUnit('mg/dL');
      setRefMinStr('');
      setRefMaxStr('');
      setReferenceRangeRaw('');
      setCategory('Metabolic');
      setFlag(null);
    }
    setError(null);
  }, [initialData, visible]);

  // Auto-calculate preview flag if not explicitly set
  const numVal = parseFloat(valueStr.replace(',', '.'));
  const numMin = refMinStr.trim() ? parseFloat(refMinStr.replace(',', '.')) : null;
  const numMax = refMaxStr.trim() ? parseFloat(refMaxStr.replace(',', '.')) : null;

  let computedFlag = flag;
  if (!computedFlag && !isNaN(numVal)) {
    if (numMin !== null && !isNaN(numMin) && numVal < numMin) {
      computedFlag = 'L';
    } else if (numMax !== null && !isNaN(numMax) && numVal > numMax) {
      computedFlag = 'H';
    } else if (numMin !== null || numMax !== null) {
      computedFlag = 'Normal';
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Biomarker name is required.');
      return;
    }
    if (!valueStr.trim() || isNaN(numVal)) {
      setError('Please enter a valid numeric value.');
      return;
    }
    if (!unit.trim()) {
      setError('Measurement unit is required.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        name: name.trim(),
        value: numVal,
        unit: unit.trim(),
        ref_min: numMin !== null && !isNaN(numMin) ? numMin : null,
        ref_max: numMax !== null && !isNaN(numMax) ? numMax : null,
        reference_range_raw: referenceRangeRaw.trim() || undefined,
        flag: flag || computedFlag || undefined,
        category: category.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save biomarker.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name={initialData ? 'pencil' : 'plus-circle-outline'}
                size={22}
                color="#2563EB"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.headerTitle}>
                {initialData ? 'Edit Biomarker Parameter' : 'Add Biomarker Parameter'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {error && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Biomarker Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Glucose, Homocysteine, Insulin, Ferritin"
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
                autoFocus={!initialData}
              />
            </View>

            {/* Value & Unit Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>
                  Value <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 95.5"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={valueStr}
                  onChangeText={setValueStr}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  Unit <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. mg/dL"
                  placeholderTextColor="#94A3B8"
                  value={unit}
                  onChangeText={setUnit}
                />
              </View>
            </View>

            {/* Quick Unit Chips */}
            <View style={styles.chipsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {COMMON_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, unit === u && styles.chipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Reference Range Min & Max */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: 10 }]}>
                <Text style={styles.label}>Ref Min</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 70"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={refMinStr}
                  onChangeText={setRefMinStr}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ref Max</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 99"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={refMaxStr}
                  onChangeText={setRefMaxStr}
                />
              </View>
            </View>

            {/* Raw Reference Text */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Raw Reference Interval (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 70 - 99, < 150, 0.4 - 4.0"
                placeholderTextColor="#94A3B8"
                value={referenceRangeRaw}
                onChangeText={setReferenceRangeRaw}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category / Panel</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lipid Panel, Metabolic, Thyroid"
                placeholderTextColor="#94A3B8"
                value={category}
                onChangeText={setCategory}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {COMMON_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Flag Selection */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Result Flag</Text>
              <View style={styles.flagOptionsRow}>
                {[
                  { label: 'Auto', val: null },
                  { label: 'Normal', val: 'Normal' },
                  { label: 'High (H)', val: 'H' },
                  { label: 'Low (L)', val: 'L' },
                ].map((item) => {
                  const isSelected = flag === item.val;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.flagBtn, isSelected && styles.flagBtnActive]}
                      onPress={() => setFlag(item.val)}
                    >
                      <Text
                        style={[
                          styles.flagBtnText,
                          isSelected && styles.flagBtnTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {computedFlag && (
                <Text style={styles.computedFlagNotice}>
                  Calculated Flag: <Text style={{ fontWeight: '700' }}>{computedFlag}</Text>
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {initialData ? 'Save Changes' : 'Add Parameter'}
                  </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  row: {
    flexDirection: 'row',
  },
  chipsContainer: {
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  flagOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flagBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  flagBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  flagBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  flagBtnTextActive: {
    color: '#2563EB',
  },
  computedFlagNotice: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
    backgroundColor: '#F8FAFC',
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

