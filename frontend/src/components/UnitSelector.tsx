import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UnitSelectorProps {
  availableUnits: string[];
  activeUnit: string;
  onSelectUnit: (unit: string) => void;
}

export const UnitSelector: React.FC<UnitSelectorProps> = ({
  availableUnits,
  activeUnit,
  onSelectUnit,
}) => {
  if (!availableUnits || availableUnits.length <= 1) {
    return (
      <View style={styles.singleUnitBadge}>
        <Text style={styles.singleUnitText}>{activeUnit}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Unit:</Text>
      <View style={styles.pillGroup}>
        {availableUnits.map((unit) => {
          const isSelected = unit === activeUnit;
          return (
            <TouchableOpacity
              key={unit}
              style={[styles.pill, isSelected && styles.pillActive]}
              onPress={() => onSelectUnit(unit)}
              activeOpacity={0.8}
            >
              <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                {unit}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  singleUnitBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  singleUnitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
});

