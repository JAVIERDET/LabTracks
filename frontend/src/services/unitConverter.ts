export interface ConvertedDataPoint {
  value: number;
  ref_min: number | null;
  ref_max: number | null;
  unit: string;
}

export const getBiomarkerCategory = (markerName: string): string | null => {
  const lower = markerName.toLowerCase();
  if (lower.includes('glucose') || lower.includes('blood sugar') || lower.includes('fbs')) return 'glucose';
  if (lower.includes('triglyceride')) return 'triglycerides';
  if (lower.includes('cholesterol') || lower.includes('hdl') || lower.includes('ldl')) return 'cholesterol';
  if (lower.includes('protein') || lower.includes('albumin')) return 'protein';
  if (lower.includes('creatinine')) return 'creatinine';
  if (lower.includes('bilirubin')) return 'bilirubin';
  if (lower.includes('calcium')) return 'calcium';
  if (lower.includes('bun') || lower.includes('urea')) return 'bun';
  if (lower.includes('vitamin d') || lower.includes('25-oh')) return 'vitamin_d';
  if (lower.includes('hemoglobin') || lower === 'hgb' || lower === 'hb') return 'hemoglobin';
  return null;
};

export const getAvailableUnitsForMarker = (
  markerName: string,
  currentUnit: string
): string[] => {
  const cat = getBiomarkerCategory(markerName);
  const unitsMap: Record<string, string[]> = {
    glucose: ['mg/dL', 'mmol/L'],
    cholesterol: ['mg/dL', 'mmol/L'],
    triglycerides: ['mg/dL', 'mmol/L'],
    protein: ['g/dL', 'g/L'],
    creatinine: ['mg/dL', 'µmol/L'],
    bilirubin: ['mg/dL', 'µmol/L'],
    calcium: ['mg/dL', 'mmol/L'],
    bun: ['mg/dL', 'mmol/L'],
    vitamin_d: ['ng/mL', 'nmol/L'],
    hemoglobin: ['g/dL', 'g/L', 'mmol/L'],
  };

  if (cat && unitsMap[cat]) {
    const list = [...unitsMap[cat]];
    if (currentUnit && !list.includes(currentUnit)) {
      list.push(currentUnit);
    }
    return list;
  }
  return currentUnit ? [currentUnit] : [];
};

export const convertValueClient = (
  markerName: string,
  val: number | null | undefined,
  fromUnit: string,
  toUnit: string
): number | null => {
  if (val === null || val === undefined || isNaN(val)) return null;
  if (!fromUnit || !toUnit || fromUnit === toUnit) return Number(val.toFixed(2));

  const cat = getBiomarkerCategory(markerName);

  // Glucose: 1 mmol/L = 18.0182 mg/dL
  if (cat === 'glucose') {
    if (fromUnit === 'mg/dL' && toUnit === 'mmol/L') return Number((val / 18.0182).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'mg/dL') return Number((val * 18.0182).toFixed(1));
  }

  // Cholesterol, HDL, LDL: 1 mmol/L = 38.67 mg/dL
  if (cat === 'cholesterol') {
    if (fromUnit === 'mg/dL' && toUnit === 'mmol/L') return Number((val / 38.67).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'mg/dL') return Number((val * 38.67).toFixed(1));
  }

  // Triglycerides: 1 mmol/L = 88.57 mg/dL
  if (cat === 'triglycerides') {
    if (fromUnit === 'mg/dL' && toUnit === 'mmol/L') return Number((val / 88.57).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'mg/dL') return Number((val * 88.57).toFixed(1));
  }

  // Proteins: 1 g/dL = 10 g/L
  if (cat === 'protein') {
    if (fromUnit === 'g/dL' && toUnit === 'g/L') return Number((val * 10).toFixed(1));
    if (fromUnit === 'g/L' && toUnit === 'g/dL') return Number((val / 10).toFixed(2));
  }

  // Creatinine: 1 mg/dL = 88.4 µmol/L
  if (cat === 'creatinine') {
    if (fromUnit === 'mg/dL' && (toUnit === 'µmol/L' || toUnit === 'umol/L')) return Number((val * 88.4).toFixed(1));
    if ((fromUnit === 'µmol/L' || fromUnit === 'umol/L') && toUnit === 'mg/dL') return Number((val / 88.4).toFixed(2));
  }

  // Bilirubin: 1 mg/dL = 17.1 µmol/L
  if (cat === 'bilirubin') {
    if (fromUnit === 'mg/dL' && (toUnit === 'µmol/L' || toUnit === 'umol/L')) return Number((val * 17.1).toFixed(1));
    if ((fromUnit === 'µmol/L' || fromUnit === 'umol/L') && toUnit === 'mg/dL') return Number((val / 17.1).toFixed(2));
  }

  // Calcium: 1 mmol/L = 4.008 mg/dL
  if (cat === 'calcium') {
    if (fromUnit === 'mg/dL' && toUnit === 'mmol/L') return Number((val / 4.008).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'mg/dL') return Number((val * 4.008).toFixed(2));
  }

  // BUN: 1 mmol/L = 2.8 mg/dL
  if (cat === 'bun') {
    if (fromUnit === 'mg/dL' && toUnit === 'mmol/L') return Number((val / 2.8).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'mg/dL') return Number((val * 2.8).toFixed(1));
  }

  // Vitamin D: 1 ng/mL = 2.496 nmol/L
  if (cat === 'vitamin_d') {
    if (fromUnit === 'ng/mL' && toUnit === 'nmol/L') return Number((val * 2.496).toFixed(1));
    if (fromUnit === 'nmol/L' && toUnit === 'ng/mL') return Number((val / 2.496).toFixed(1));
  }

  // Hemoglobin: 1 g/dL = 10 g/L, 1 mmol/L = 1.611 g/dL
  if (cat === 'hemoglobin') {
    if (fromUnit === 'g/dL' && toUnit === 'g/L') return Number((val * 10).toFixed(1));
    if (fromUnit === 'g/L' && toUnit === 'g/dL') return Number((val / 10).toFixed(2));
    if (fromUnit === 'g/dL' && toUnit === 'mmol/L') return Number((val / 1.611).toFixed(2));
    if (fromUnit === 'mmol/L' && toUnit === 'g/dL') return Number((val * 1.611).toFixed(2));
  }

  return Number(val.toFixed(2));
};

export const convertPointClient = (
  markerName: string,
  value: number,
  refMin: number | null | undefined,
  refMax: number | null | undefined,
  fromUnit: string,
  toUnit: string
): ConvertedDataPoint => {
  return {
    value: convertValueClient(markerName, value, fromUnit, toUnit) ?? value,
    ref_min: convertValueClient(markerName, refMin, fromUnit, toUnit),
    ref_max: convertValueClient(markerName, refMax, fromUnit, toUnit),
    unit: toUnit,
  };
};

export const CLINICAL_PANEL_ORDER: Record<string, number> = {
  'Lipid Panel': 1,
  'Metabolic Panel': 2,
  'Liver Function': 3,
  'Kidney Function': 4,
  'Electrolytes': 5,
  'Hematology': 6,
  'Thyroid': 7,
  'Cardiovascular & Inflammation': 8,
  'Vitamins': 9,
  'Other': 10,
};

export const detectClinicalPanel = (markerName: string): string => {
  const lower = markerName.toLowerCase();
  if (
    lower.includes('cholesterol') ||
    lower.includes('colesterol') ||
    lower.includes('hdl') ||
    lower.includes('ldl') ||
    lower.includes('triglycerid') ||
    lower.includes('triglicérid') ||
    lower.includes('triglicerid') ||
    lower.includes('apob') ||
    lower.includes('lipid') ||
    lower.includes('lipoprote')
  ) {
    return 'Lipid Panel';
  }
  if (
    lower.includes('glucose') ||
    lower.includes('glucosa') ||
    lower.includes('hba1c') ||
    lower.includes('insulin') ||
    lower.includes('sugar')
  ) {
    return 'Metabolic Panel';
  }
  if (
    lower.includes('alt') ||
    lower.includes('ast') ||
    lower.includes('gpt') ||
    lower.includes('got') ||
    lower.includes('ggt') ||
    lower.includes('bilirubin') ||
    lower.includes('bilirrubina') ||
    lower.includes('fosfatasa') ||
    lower.includes('alkaline phosphatase')
  ) {
    return 'Liver Function';
  }
  if (
    lower.includes('creatinin') ||
    lower.includes('bun') ||
    lower.includes('urea') ||
    lower.includes('uric') ||
    lower.includes('úrico') ||
    lower.includes('urico') ||
    lower.includes('filtrado') ||
    lower.includes('egfr')
  ) {
    return 'Kidney Function';
  }
  if (
    lower.includes('sodio') ||
    lower.includes('sodium') ||
    lower.includes('potasio') ||
    lower.includes('potassium') ||
    lower.includes('cloro') ||
    lower.includes('chloride') ||
    lower.includes('calcio') ||
    lower.includes('calcium') ||
    lower.includes('magnesio') ||
    lower.includes('magnesium')
  ) {
    return 'Electrolytes';
  }
  if (
    lower.includes('hemoglobin') ||
    lower.includes('hematocrit') ||
    lower.includes('hematocrito') ||
    lower.includes('plaqueta') ||
    lower.includes('platelet') ||
    lower.includes('leucocit') ||
    lower.includes('leukocyt') ||
    lower.includes('hematie') ||
    lower.includes('vcm') ||
    lower.includes('mcv') ||
    lower.includes('hcm') ||
    lower.includes('mch') ||
    lower.includes('linfocit') ||
    lower.includes('lymphocyt') ||
    lower.includes('neutrofil') ||
    lower.includes('neutrophil')
  ) {
    return 'Hematology';
  }
  if (
    lower.includes('tsh') ||
    lower.includes('t3') ||
    lower.includes('t4') ||
    lower.includes('tiro')
  ) {
    return 'Thyroid';
  }
  if (
    lower.includes('crp') ||
    lower.includes('pcr') ||
    lower.includes('homociste') ||
    lower.includes('homocyst') ||
    lower.includes('ferritin') ||
    lower.includes('vsg') ||
    lower.includes('esr')
  ) {
    return 'Cardiovascular & Inflammation';
  }
  if (
    lower.includes('vitamin') ||
    lower.includes('vitamina') ||
    lower.includes('folato') ||
    lower.includes('folate') ||
    lower.includes('b12')
  ) {
    return 'Vitamins';
  }
  return 'Other';
};

export const sortBiomarkersIntelligently = (
  markerNames: string[],
  mode: 'clinical' | 'flagged' | 'alphabetical' | 'custom',
  catalogMap?: Record<string, { latest_flag?: string | null; category?: string | null }>
): string[] => {
  const copy = [...markerNames];
  if (mode === 'custom') {
    return copy;
  }
  if (mode === 'alphabetical') {
    return copy.sort((a, b) => a.localeCompare(b));
  }
  if (mode === 'flagged') {
    return copy.sort((a, b) => {
      const flagA = catalogMap?.[a]?.latest_flag || '';
      const flagB = catalogMap?.[b]?.latest_flag || '';
      const isAbnormalA = flagA === 'H' || flagA === 'L' ? 1 : 0;
      const isAbnormalB = flagB === 'H' || flagB === 'L' ? 1 : 0;
      if (isAbnormalA !== isAbnormalB) return isAbnormalB - isAbnormalA;
      return a.localeCompare(b);
    });
  }
  // Clinical Panel ordering (Default)
  return copy.sort((a, b) => {
    const panelA = detectClinicalPanel(a);
    const panelB = detectClinicalPanel(b);
    const orderA = CLINICAL_PANEL_ORDER[panelA] ?? 99;
    const orderB = CLINICAL_PANEL_ORDER[panelB] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });
};


