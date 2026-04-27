export const CANONICAL_MAP: Record<string, string> = {
  // Haemoglobin
  hb: 'haemoglobin',
  hgb: 'haemoglobin',
  hemoglobin: 'haemoglobin',
  haemoglobin: 'haemoglobin',
  'haemoglobin (hb)': 'haemoglobin',
  'haemoglobin (hb) ': 'haemoglobin',
  'haemoglobin (hb) ': 'haemoglobin',
  'haemoglobin (hb)': 'haemoglobin',
  'haemoglobin (hb) ': 'haemoglobin',

  // Allow common spacing variants.
  'hb ': 'haemoglobin',

  // Blood Sugar
  fbs: 'fasting_blood_sugar',
  'fasting blood sugar': 'fasting_blood_sugar',
  'fasting glucose': 'fasting_blood_sugar',
  'blood glucose fasting': 'fasting_blood_sugar',
  rbs: 'random_blood_sugar',
  ppbs: 'postprandial_blood_sugar',

  // Thyroid
  tsh: 'tsh',
  'thyroid stimulating hormone': 'tsh',
  t3: 't3_total',
  t4: 't4_total',
  ft3: 't3_free',
  ft4: 't4_free',

  // Lipid Profile
  'total cholesterol': 'cholesterol_total',
  cholesterol: 'cholesterol_total',
  ldl: 'cholesterol_ldl',
  'ldl cholesterol': 'cholesterol_ldl',
  hdl: 'cholesterol_hdl',
  'hdl cholesterol': 'cholesterol_hdl',
  triglycerides: 'triglycerides',
  tg: 'triglycerides',

  // Iron Studies
  'serum ferritin': 'ferritin',
  ferritin: 'ferritin',
  'serum iron': 'serum_iron',
  tibc: 'tibc',

  // Liver
  sgpt: 'alt',
  alt: 'alt',
  'alanine aminotransferase': 'alt',
  sgot: 'ast',
  ast: 'ast',
  'aspartate aminotransferase': 'ast',

  // Kidney
  'serum creatinine': 'creatinine',
  creatinine: 'creatinine',
  'blood urea nitrogen': 'bun',
  bun: 'bun',
  urea: 'urea',

  // CBC
  wbc: 'wbc',
  'white blood cells': 'wbc',
  'total leucocyte count': 'wbc',
  tlc: 'wbc',
  rbc: 'rbc',
  'red blood cells': 'rbc',
  'rbc count': 'rbc',
  platelets: 'platelets',
  'platelet count': 'platelets',
  plt: 'platelets',

  // Vitamins
  'vitamin d': 'vitamin_d',
  'vitamin d3': 'vitamin_d',
  '25-oh vitamin d': 'vitamin_d',
  'vitamin b12': 'vitamin_b12',
  cyanocobalamin: 'vitamin_b12',

  // CBC sub-indices (common in Apollo / Thyrocare / Lal Path panels)
  mcv: 'mcv',
  'mean corpuscular volume': 'mcv',
  mch: 'mch',
  'mean corpuscular haemoglobin': 'mch',
  mchc: 'mchc',
  'mean corpuscular haemoglobin concentration': 'mchc',
  hct: 'hematocrit',
  pcv: 'hematocrit',
  'packed cell volume': 'hematocrit',
  hematocrit: 'hematocrit',
  haematocrit: 'hematocrit',
  'neutrophils': 'neutrophils',
  'neutrophil': 'neutrophils',
  'lymphocytes': 'lymphocytes',
  'lymphocyte': 'lymphocytes',
  'monocytes': 'monocytes',
  'eosinophils': 'eosinophils',
  'basophils': 'basophils',

  // Coagulation (PT / INR / aPTT — standard in liver panels and pre-op screens)
  pt: 'prothrombin_time',
  'prothrombin time': 'prothrombin_time',
  'pt/inr': 'inr',
  inr: 'inr',
  'international normalised ratio': 'inr',
  'international normalized ratio': 'inr',
  aptt: 'aptt',
  'activated partial thromboplastin time': 'aptt',
  'partial thromboplastin time': 'aptt',
  ptt: 'aptt',

  // Inflammation markers (CRP & ESR — included in most full-body panels)
  crp: 'crp',
  'c-reactive protein': 'crp',
  'c reactive protein': 'crp',
  'hs-crp': 'crp_hs',
  'high sensitivity crp': 'crp_hs',
  esr: 'esr',
  'erythrocyte sedimentation rate': 'esr',
  'westergren esr': 'esr',

  // Bone markers (calcium, phosphorus, ALP)
  calcium: 'calcium',
  'serum calcium': 'calcium',
  phosphorus: 'phosphorus',
  'serum phosphorus': 'phosphorus',
  phosphate: 'phosphorus',
  'inorganic phosphate': 'phosphorus',
  alp: 'alp',
  'alkaline phosphatase': 'alp',
  'alk phosphatase': 'alp',

  // Liver (additional)
  'total bilirubin': 'bilirubin_total',
  'bilirubin total': 'bilirubin_total',
  'direct bilirubin': 'bilirubin_direct',
  'indirect bilirubin': 'bilirubin_indirect',
  'total protein': 'protein_total',
  albumin: 'albumin',
  'serum albumin': 'albumin',
  globulin: 'globulin',
  ggt: 'ggt',
  'gamma gt': 'ggt',
  'gamma glutamyl transferase': 'ggt',

  // Kidney (additional)
  'uric acid': 'uric_acid',
  'serum uric acid': 'uric_acid',
  egfr: 'egfr',
  'estimated gfr': 'egfr',

  // Hormones (testosterone, cortisol, oestrogens, progesterone)
  testosterone: 'testosterone',
  'total testosterone': 'testosterone',
  'serum testosterone': 'testosterone',
  cortisol: 'cortisol',
  'serum cortisol': 'cortisol',
  estradiol: 'estradiol',
  'oestradiol': 'estradiol',
  'e2': 'estradiol',
  progesterone: 'progesterone',
  'serum progesterone': 'progesterone',
  'lh': 'lh',
  'luteinising hormone': 'lh',
  'luteinizing hormone': 'lh',
  'fsh': 'fsh',
  'follicle stimulating hormone': 'fsh',
  prolactin: 'prolactin',
  'serum prolactin': 'prolactin',

  // Urine routine & microscopy (Lal Path / SRL standard panel)
  'urine ph': 'urine_ph',
  'urine protein': 'urine_protein',
  'urine glucose': 'urine_glucose',
  'urine ketones': 'urine_ketones',
  'urine rbc': 'urine_rbc',
  'rbc (urine)': 'urine_rbc',
  'urine wbc': 'urine_wbc',
  'wbc (urine)': 'urine_wbc',
  'urine pus cells': 'urine_wbc',
  'urine specific gravity': 'urine_specific_gravity',
}

