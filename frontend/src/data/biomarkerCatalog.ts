import type { BiomarkerEntry } from '../types/biomarkers'

/** Curated reference copy keyed by `canonical_name` — not user lab data. */
const ENTRIES: BiomarkerEntry[] = [

  // ─── Complete Blood Count ───────────────────────────────────────────────────

  {
    id: 'bm-1',
    canonical_name: 'haemoglobin',
    display_name: 'Haemoglobin',
    aliases: ['Hb', 'HGB', 'Hemoglobin'],
    category: 'Blood',
    normal_range_male: '13.5–17.5 g/dL',
    normal_range_female: '12.0–15.5 g/dL',
    description:
      'Haemoglobin is the iron-containing protein inside red blood cells that carries oxygen from your lungs to every tissue in your body, and returns carbon dioxide back to the lungs. It is the primary marker for anaemia — low levels can cause fatigue, breathlessness, pale skin, and reduced exercise tolerance.',
    causes_high: ['Dehydration', 'High altitude living', 'Polycythaemia vera', 'Smoking', 'COPD'],
    causes_low: [
      'Iron deficiency anaemia',
      'Vitamin B12 or folate deficiency',
      'Chronic blood loss (heavy periods, ulcers)',
      'Thalassaemia trait',
      'Chronic kidney disease',
    ],
  },
  {
    id: 'bm-2',
    canonical_name: 'platelet_count',
    display_name: 'Platelet Count',
    aliases: ['PLT', 'Thrombocytes'],
    category: 'Blood',
    normal_range_male: '1.5–4.0 lakh/µL',
    normal_range_female: '1.5–4.0 lakh/µL',
    description:
      'Platelets are the smallest blood cells, responsible for plugging vessel walls and triggering the clotting cascade when you bleed. A very low count increases bleeding risk; a very high count can increase clotting risk. Dengue fever is a common cause of sudden platelet drops in India.',
    causes_high: ['Infection', 'Iron deficiency anaemia', 'Inflammatory conditions', 'Post-surgery', 'Splenectomy'],
    causes_low: ['Dengue fever', 'Viral infections', 'Leukaemia', 'Certain medications', 'Autoimmune disorders (ITP)'],
  },
  {
    id: 'bm-cbc-wbc',
    canonical_name: 'total_leukocyte_count',
    display_name: 'White Blood Cell Count (WBC)',
    aliases: ['WBC', 'TLC', 'Total Leucocyte Count', 'Leukocytes'],
    category: 'Blood',
    normal_range_male: '4,000–11,000 /µL',
    normal_range_female: '4,000–11,000 /µL',
    description:
      'White blood cells are the foot soldiers of your immune system. They detect and destroy bacteria, viruses, and other foreign invaders. The total WBC count gives an overview of immune system activity — a high count often signals an active infection or inflammation, while a very low count can mean the immune system is compromised.',
    causes_high: ['Bacterial infection', 'Viral infection', 'Inflammation', 'Stress', 'Steroid medications', 'Leukaemia'],
    causes_low: ['Viral infections (HIV, hepatitis)', 'Chemotherapy', 'Autoimmune disorders', 'Bone marrow disorders', 'Severe bacterial sepsis'],
  },
  {
    id: 'bm-cbc-rbc',
    canonical_name: 'rbc_count',
    display_name: 'Red Blood Cell Count (RBC)',
    aliases: ['RBC', 'Erythrocyte Count', 'Red Cell Count'],
    category: 'Blood',
    normal_range_male: '4.5–5.5 million/µL',
    normal_range_female: '4.0–5.0 million/µL',
    description:
      'The RBC count measures the total number of red blood cells in a volume of blood. Red blood cells carry haemoglobin and oxygen. When the count is low (together with low haemoglobin), it confirms anaemia. An unusually high count is called polycythaemia.',
    causes_high: ['Dehydration', 'Polycythaemia vera', 'High altitude', 'COPD', 'Smoking'],
    causes_low: ['Iron deficiency anaemia', 'Haemolysis', 'Bone marrow suppression', 'Chronic kidney disease', 'Nutritional deficiency'],
  },
  {
    id: 'bm-cbc-hct',
    canonical_name: 'packed_cell_volume',
    display_name: 'Packed Cell Volume (PCV / Haematocrit)',
    aliases: ['PCV', 'Haematocrit', 'HCT'],
    category: 'Blood',
    normal_range_male: '40–52%',
    normal_range_female: '36–47%',
    description:
      'PCV (or haematocrit) is the percentage of your blood volume made up of red blood cells. It moves in the same direction as haemoglobin — low PCV confirms anaemia; high PCV can indicate dehydration or polycythaemia. It is one of three core anaemia indices alongside haemoglobin and RBC count.',
    causes_high: ['Dehydration', 'Polycythaemia vera', 'High altitude', 'COPD'],
    causes_low: ['Anaemia (any cause)', 'Blood loss', 'Bone marrow disorders', 'Chronic kidney disease', 'Pregnancy'],
  },
  {
    id: 'bm-cbc-mcv',
    canonical_name: 'mcv',
    display_name: 'Mean Corpuscular Volume (MCV)',
    aliases: ['MCV'],
    category: 'Blood',
    normal_range_male: '80–100 fL',
    normal_range_female: '80–100 fL',
    description:
      'MCV measures the average size of your red blood cells. It is the most useful test for identifying the type of anaemia: small cells (microcytic, low MCV) suggest iron deficiency or thalassaemia; large cells (macrocytic, high MCV) point to B12 or folate deficiency. Normal-sized cells with low haemoglobin suggest chronic disease or early deficiency.',
    causes_high: ['Vitamin B12 deficiency', 'Folate deficiency', 'Alcohol excess', 'Liver disease', 'Hypothyroidism'],
    causes_low: ['Iron deficiency anaemia', 'Thalassaemia trait', 'Anaemia of chronic disease'],
  },
  {
    id: 'bm-cbc-mch',
    canonical_name: 'mch',
    display_name: 'Mean Corpuscular Haemoglobin (MCH)',
    aliases: ['MCH'],
    category: 'Blood',
    normal_range_male: '27–32 pg',
    normal_range_female: '27–32 pg',
    description:
      'MCH is the average amount of haemoglobin packed inside a single red blood cell. It almost always moves together with MCV. Low MCH (hypochromic cells) is characteristic of iron deficiency; high MCH (hyperchromic) occurs in macrocytic anaemias caused by B12 or folate deficiency.',
    causes_high: ['Vitamin B12 deficiency', 'Folate deficiency', 'Hypothyroidism'],
    causes_low: ['Iron deficiency anaemia', 'Thalassaemia trait', 'Chronic inflammation'],
  },
  {
    id: 'bm-cbc-mchc',
    canonical_name: 'mchc',
    display_name: 'Mean Corpuscular Haemoglobin Concentration (MCHC)',
    aliases: ['MCHC'],
    category: 'Blood',
    normal_range_male: '31.5–35 g/dL',
    normal_range_female: '31.5–35 g/dL',
    description:
      'MCHC is the concentration of haemoglobin within a given volume of red blood cells — essentially how densely packed the haemoglobin is. Low MCHC (pale cells, hypochromia) points strongly to iron deficiency. It is rarely elevated, but a very high MCHC can indicate hereditary spherocytosis.',
    causes_high: ['Hereditary spherocytosis', 'Severe dehydration (spurious)'],
    causes_low: ['Iron deficiency anaemia', 'Thalassaemia', 'Sideroblastic anaemia'],
  },
  {
    id: 'bm-cbc-rdw',
    canonical_name: 'rdw',
    display_name: 'Red Cell Distribution Width (RDW)',
    aliases: ['RDW', 'RDW-CV', 'RDW-SD'],
    category: 'Blood',
    normal_range_male: '11.5–14.5%',
    normal_range_female: '11.5–14.5%',
    description:
      'RDW measures how much variation there is in the size of your red blood cells. A high RDW (wide variation) is one of the earliest signs of nutritional anaemia — especially iron, B12, or folate deficiency — even before haemoglobin drops. Normal RDW with low MCV points more toward thalassaemia trait.',
    causes_high: ['Iron deficiency anaemia', 'Vitamin B12 or folate deficiency', 'Mixed nutritional deficiency', 'Recent blood transfusion'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-cbc-neutrophils',
    canonical_name: 'neutrophils',
    display_name: 'Neutrophils',
    aliases: ['Polymorphs', 'PMN', 'Granulocytes', 'Segmented Neutrophils'],
    category: 'Blood',
    normal_range_male: '40–70% (or 1,800–7,700 /µL)',
    normal_range_female: '40–70% (or 1,800–7,700 /µL)',
    description:
      'Neutrophils are the most abundant white blood cells and the first line of defence against bacterial infections. They engulf and destroy bacteria. A high neutrophil count (neutrophilia) almost always means a bacterial infection is present. A low count (neutropenia) greatly increases infection risk.',
    causes_high: ['Bacterial infection', 'Stress (physical or emotional)', 'Steroid medications', 'Inflammatory conditions', 'Heart attack'],
    causes_low: ['Viral infections', 'Chemotherapy', 'Severe bacterial infections (sepsis)', 'Autoimmune disease', 'Bone marrow failure'],
  },
  {
    id: 'bm-cbc-lymphocytes',
    canonical_name: 'lymphocytes',
    display_name: 'Lymphocytes',
    aliases: ['Lymphs'],
    category: 'Blood',
    normal_range_male: '20–45% (or 1,000–4,800 /µL)',
    normal_range_female: '20–45% (or 1,000–4,800 /µL)',
    description:
      'Lymphocytes are specialised white blood cells that mount targeted immune responses. B-lymphocytes produce antibodies; T-lymphocytes directly attack infected cells. High lymphocytes often accompany viral infections (including typhoid and dengue) or certain leukaemias. Low lymphocytes can suggest HIV or immunosuppression.',
    causes_high: ['Viral infections (dengue, EBV, CMV)', 'Tuberculosis', 'Lymphocytic leukaemia', 'Pertussis'],
    causes_low: ['HIV/AIDS', 'Steroid use', 'Chemotherapy', 'Autoimmune disease', 'Severe stress'],
  },
  {
    id: 'bm-cbc-eosinophils',
    canonical_name: 'eosinophils',
    display_name: 'Eosinophils',
    aliases: ['Eos'],
    category: 'Blood',
    normal_range_male: '1–6% (or 100–500 /µL)',
    normal_range_female: '1–6% (or 100–500 /µL)',
    description:
      'Eosinophils are white blood cells that play a key role in fighting parasitic infections and driving allergic reactions. In India, elevated eosinophils are commonly caused by intestinal parasites or allergies. Very high counts (hypereosinophilia) can indicate tropical eosinophilia from filarial worm infection.',
    causes_high: ['Parasitic infections (roundworm, hookworm)', 'Allergies and asthma', 'Tropical eosinophilia (filariasis)', 'Drug reactions', 'Atopic eczema'],
    causes_low: ['Steroid medications', 'Acute bacterial infection', 'Stress response'],
  },
  {
    id: 'bm-cbc-monocytes',
    canonical_name: 'monocytes',
    display_name: 'Monocytes',
    aliases: ['Mono'],
    category: 'Blood',
    normal_range_male: '2–8% (or 200–800 /µL)',
    normal_range_female: '2–8% (or 200–800 /µL)',
    description:
      'Monocytes are large white blood cells that mature into macrophages — the clean-up crew of the immune system. They engulf dead cells and debris, and help orchestrate immune responses. Elevated monocytes often accompany chronic infections (tuberculosis, malaria), inflammatory diseases, or autoimmune conditions.',
    causes_high: ['Tuberculosis', 'Malaria', 'Chronic inflammatory disease', 'Viral infections', 'Monocytic leukaemia'],
    causes_low: ['Steroid use', 'Aplastic anaemia', 'Hairy cell leukaemia'],
  },

  // ─── Metabolic / Diabetes ───────────────────────────────────────────────────

  {
    id: 'bm-3',
    canonical_name: 'serum_glucose_fasting',
    display_name: 'Serum Glucose (Fasting)',
    aliases: ['FBS', 'Fasting Blood Sugar', 'FPG', 'FBG'],
    category: 'Metabolic',
    normal_range_male: '70–99 mg/dL',
    normal_range_female: '70–99 mg/dL',
    description:
      'Fasting blood glucose measures the concentration of sugar in your blood after at least 8 hours without food or drink (water is fine). It is the primary screening test for diabetes and pre-diabetes. Since stress hormones also raise blood sugar, a mildly elevated result is always confirmed with a repeat test or HbA1c.',
    causes_high: ['Type 2 diabetes', 'Pre-diabetes', 'Stress', 'Steroid medications', 'Pancreatic disorders', 'Cushing\'s syndrome'],
    causes_low: ['Excess insulin dose', 'Skipping meals', 'Alcohol consumption', 'Insulinoma (rare)', 'Adrenal insufficiency'],
  },
  {
    id: 'bm-pp-glucose',
    canonical_name: 'post_prandial_glucose',
    display_name: 'Post-Prandial Glucose (PPBS)',
    aliases: ['PPBS', 'PP Blood Sugar', '2-hr Post Glucose', 'Post Meal Sugar'],
    category: 'Metabolic',
    normal_range_male: 'Below 140 mg/dL',
    normal_range_female: 'Below 140 mg/dL',
    description:
      'Post-prandial blood sugar is measured exactly 2 hours after a meal. It shows how efficiently your body clears glucose after eating. While fasting glucose may be normal in early pre-diabetes, the 2-hour value is often the first to become abnormal. Values of 140–199 mg/dL suggest impaired glucose tolerance (pre-diabetes).',
    causes_high: ['Type 2 diabetes', 'Pre-diabetes', 'Very high-carbohydrate meal', 'Steroid use', 'Stress'],
    causes_low: ['Excess insulin or medication', 'Delayed gastric emptying (gastroparesis)', 'Exercise shortly after eating'],
  },
  {
    id: 'bm-4',
    canonical_name: 'hba1c',
    display_name: 'HbA1c',
    aliases: ['Glycated Haemoglobin', 'A1c', 'Glycosylated Hb', 'Glycohaemoglobin'],
    category: 'Metabolic',
    normal_range_male: 'Below 5.7%',
    normal_range_female: 'Below 5.7%',
    description:
      'HbA1c measures the percentage of haemoglobin that has glucose permanently attached to it. Since red blood cells live for about 90 days, HbA1c reflects your average blood sugar level over the past 2–3 months. No fasting is required. It is both a diagnostic test for diabetes and the gold-standard way to monitor long-term sugar control.',
    causes_high: ['Poorly controlled diabetes', 'Pre-diabetes (5.7–6.4%)', 'Iron deficiency anaemia (falsely elevated)'],
    causes_low: ['Haemolytic anaemia', 'Recent blood transfusion', 'Certain haemoglobin variants', 'Overtreatment with diabetic medications'],
  },

  // ─── Thyroid ────────────────────────────────────────────────────────────────

  {
    id: 'bm-5',
    canonical_name: 'tsh',
    display_name: 'TSH',
    aliases: ['Thyroid Stimulating Hormone', 'Thyrotropin'],
    category: 'Thyroid',
    normal_range_male: '0.5–4.5 mIU/L',
    normal_range_female: '0.5–4.5 mIU/L',
    description:
      'TSH is produced by the pituitary gland in the brain and acts as a thermostat signal to the thyroid. When thyroid hormone levels are low, the pituitary turns up the signal — so a high TSH means the thyroid is underactive (hypothyroidism). A low TSH means the thyroid is over-producing (hyperthyroidism). It is the single best screening test for thyroid disorders.',
    causes_high: ['Hypothyroidism', "Hashimoto's thyroiditis", 'Iodine deficiency', 'Certain medications (lithium, amiodarone)'],
    causes_low: ['Hyperthyroidism', "Graves' disease", 'Excess thyroid hormone medication', 'Pituitary disorders'],
  },
  {
    id: 'bm-6',
    canonical_name: 't4_free',
    display_name: 'Free T4',
    aliases: ['Free Thyroxine', 'FT4', 'fT4'],
    category: 'Thyroid',
    normal_range_male: '0.8–1.8 ng/dL',
    normal_range_female: '0.8–1.8 ng/dL',
    description:
      'Free T4 (free thyroxine) is the active, unbound form of the main thyroid hormone. Unlike total T4, it is not affected by the proteins that transport thyroid hormone in the blood, making it a more accurate measure. It is measured alongside TSH to confirm and characterise thyroid dysfunction.',
    causes_high: ['Hyperthyroidism', 'Acute thyroiditis', 'Excess iodine intake', 'Amiodarone therapy'],
    causes_low: ['Hypothyroidism', 'Pituitary failure', 'Severe illness (sick euthyroid syndrome)'],
  },
  {
    id: 'bm-t3-total',
    canonical_name: 't3_total',
    display_name: 'Total T3',
    aliases: ['Total Triiodothyronine', 'T3', 'Serum T3'],
    category: 'Thyroid',
    normal_range_male: '80–200 ng/dL',
    normal_range_female: '80–200 ng/dL',
    description:
      'T3 (triiodothyronine) is the most biologically active thyroid hormone. Most T3 in the blood is converted from T4 in tissues rather than secreted directly by the thyroid. Total T3 measures both bound and free forms. It is useful in diagnosing hyperthyroidism when TSH is low but free T4 is normal (T3 toxicosis).',
    causes_high: ['Hyperthyroidism', 'T3 toxicosis', 'Excess thyroid hormone', 'Pregnancy'],
    causes_low: ['Hypothyroidism', 'Severe illness', 'Malnutrition', 'Chronic kidney or liver disease'],
  },
  {
    id: 'bm-t3-free',
    canonical_name: 't3_free',
    display_name: 'Free T3',
    aliases: ['Free Triiodothyronine', 'FT3', 'fT3'],
    category: 'Thyroid',
    normal_range_male: '2.3–4.2 pg/mL',
    normal_range_female: '2.3–4.2 pg/mL',
    description:
      'Free T3 is the unbound, biologically active fraction of triiodothyronine that acts on cells to control metabolism, heart rate, body temperature, and energy use. It provides the most direct measure of active thyroid hormone at the cellular level.',
    causes_high: ['Hyperthyroidism', "Graves' disease", 'T3 toxicosis'],
    causes_low: ['Hypothyroidism', 'Severe illness', 'Kidney disease', 'Malnutrition'],
  },
  {
    id: 'bm-anti-tpo',
    canonical_name: 'anti_tpo',
    display_name: 'Anti-TPO Antibody',
    aliases: ['TPO Antibody', 'Thyroid Peroxidase Antibody', 'Anti-Thyroid Peroxidase'],
    category: 'Thyroid',
    normal_range_male: 'Below 35 IU/mL',
    normal_range_female: 'Below 35 IU/mL',
    description:
      'Anti-TPO antibodies are produced by the immune system and mistakenly attack thyroid peroxidase, an enzyme essential for making thyroid hormones. Their presence indicates an autoimmune attack on the thyroid (autoimmune thyroiditis). High levels are strongly associated with Hashimoto\'s thyroiditis and can predict future hypothyroidism even when TSH is currently normal.',
    causes_high: ["Hashimoto's thyroiditis", "Graves' disease", 'Type 1 diabetes', 'Other autoimmune conditions'],
    causes_low: ['Generally not clinically significant (low or absent is normal)'],
  },

  // ─── Vitamins ────────────────────────────────────────────────────────────────

  {
    id: 'bm-7',
    canonical_name: 'vitamin_d',
    display_name: 'Vitamin D (25-OH)',
    aliases: ['25-Hydroxyvitamin D', 'Cholecalciferol', 'Vit D3', '25(OH)D'],
    category: 'Vitamins',
    normal_range_male: '30–100 ng/mL',
    normal_range_female: '30–100 ng/mL',
    description:
      'Vitamin D (measured as 25-hydroxyvitamin D) is both a vitamin and a hormone. It is essential for calcium absorption and bone mineralisation, immune function, muscle strength, and mood regulation. The skin makes it when exposed to sunlight (UVB). Deficiency is extremely common among urban Indians due to indoor lifestyles, clothing coverage, and darker skin pigmentation requiring longer sun exposure.',
    causes_high: ['Excessive supplementation', 'Granulomatous diseases (sarcoidosis, TB)', 'Some lymphomas'],
    causes_low: [
      'Insufficient sunlight exposure',
      'Low dietary intake',
      'Malabsorption (coeliac, Crohn\'s)',
      'Obesity',
      'Kidney or liver disease',
      'Dark skin + indoor lifestyle',
    ],
  },
  {
    id: 'bm-8',
    canonical_name: 'vitamin_b12',
    display_name: 'Vitamin B12',
    aliases: ['Cobalamin', 'Cyanocobalamin', 'B12', 'Serum B12'],
    category: 'Vitamins',
    normal_range_male: '200–900 pg/mL',
    normal_range_female: '200–900 pg/mL',
    description:
      'Vitamin B12 is essential for making DNA, maintaining the fatty sheath (myelin) that protects nerve fibres, and producing red blood cells. Since B12 is found almost exclusively in animal products (meat, fish, dairy, eggs), deficiency is highly prevalent in India — especially among vegetarians and vegans. Prolonged deficiency causes nerve damage that can be irreversible.',
    causes_high: ['Liver disease', 'Myeloproliferative disorders', 'Kidney failure', 'Excess supplementation'],
    causes_low: [
      'Vegetarian or vegan diet without supplementation',
      'Pernicious anaemia (autoimmune)',
      'Gastrointestinal disorders (IBD, gastric bypass)',
      'Prolonged metformin use',
      'Older age (reduced absorption)',
    ],
  },

  // ─── Lipid Panel ────────────────────────────────────────────────────────────

  {
    id: 'bm-lipid-total',
    canonical_name: 'total_cholesterol',
    display_name: 'Total Cholesterol',
    aliases: ['Serum Cholesterol', 'Cholesterol'],
    category: 'Lipids',
    normal_range_male: 'Below 200 mg/dL',
    normal_range_female: 'Below 200 mg/dL',
    description:
      'Total cholesterol is the sum of all cholesterol-carrying particles in your blood — HDL ("good"), LDL ("bad"), VLDL, and others. Cholesterol is an essential molecule for building cell membranes and making hormones; the problem is excess. High total cholesterol is a major risk factor for plaque build-up in arteries, heart attacks, and strokes. It must always be interpreted alongside the HDL and LDL breakdown.',
    causes_high: ['Unhealthy diet (saturated and trans fats)', 'Genetic hypercholesterolaemia', 'Hypothyroidism', 'Kidney disease', 'Type 2 diabetes', 'Sedentary lifestyle'],
    causes_low: ['Malnutrition', 'Liver disease', 'Hyperthyroidism', 'Malabsorption syndromes', 'Statin therapy (intentional)'],
  },
  {
    id: 'bm-lipid-ldl',
    canonical_name: 'ldl_cholesterol',
    display_name: 'LDL Cholesterol',
    aliases: ['LDL', 'Low-Density Lipoprotein', 'Bad Cholesterol'],
    category: 'Lipids',
    normal_range_male: 'Below 100 mg/dL',
    normal_range_female: 'Below 100 mg/dL',
    description:
      'LDL carries cholesterol from the liver to cells throughout the body. When there is too much LDL, it deposits cholesterol in artery walls, forming plaques (atherosclerosis). This narrows arteries and is the primary driver of heart attacks and strokes. LDL is the main target of cholesterol-lowering medications (statins). For people with diabetes or heart disease, the target is below 70 mg/dL.',
    causes_high: ['High saturated and trans fat intake', 'Genetic hypercholesterolaemia', 'Hypothyroidism', 'Kidney disease', 'Diabetes', 'Obesity'],
    causes_low: ['Statin therapy', 'Malnutrition', 'Liver disease', 'Hyperthyroidism', 'Malabsorption'],
  },
  {
    id: 'bm-lipid-hdl',
    canonical_name: 'hdl_cholesterol',
    display_name: 'HDL Cholesterol',
    aliases: ['HDL', 'High-Density Lipoprotein', 'Good Cholesterol'],
    category: 'Lipids',
    normal_range_male: 'Above 40 mg/dL (ideally >60)',
    normal_range_female: 'Above 50 mg/dL (ideally >60)',
    description:
      'HDL is the "good" cholesterol that acts as a scavenger — it picks up excess cholesterol from artery walls and carries it back to the liver for disposal. Higher HDL is protective against heart disease. Importantly, a low HDL is an independent risk factor for cardiovascular disease, even if total cholesterol is normal. Regular aerobic exercise is one of the most effective ways to raise HDL.',
    causes_high: ['Regular aerobic exercise', 'Moderate alcohol (controversial)', 'Genetic factors', 'Oestrogen (pre-menopause)'],
    causes_low: ['Sedentary lifestyle', 'Obesity', 'Type 2 diabetes', 'Smoking', 'High-carbohydrate diet', 'Trans fats'],
  },
  {
    id: 'bm-lipid-tg',
    canonical_name: 'triglycerides',
    display_name: 'Triglycerides',
    aliases: ['TG', 'Serum Triglycerides', 'TRIG'],
    category: 'Lipids',
    normal_range_male: 'Below 150 mg/dL',
    normal_range_female: 'Below 150 mg/dL',
    description:
      'Triglycerides are the most common type of fat in the body. After eating, your body converts unused calories — especially from refined carbohydrates, sugary foods, and alcohol — into triglycerides and stores them in fat cells. High triglycerides combined with low HDL and high waist circumference are the hallmarks of metabolic syndrome. Urban Indians with high-carb diets tend to have particularly elevated levels.',
    causes_high: ['High refined carbohydrate and sugar intake', 'Alcohol consumption', 'Obesity', 'Type 2 diabetes', 'Hypothyroidism', 'Kidney disease', 'Genetic hypertriglyceridaemia'],
    causes_low: ['Low-fat diet', 'Malnutrition', 'Hyperthyroidism', 'Malabsorption'],
  },
  {
    id: 'bm-lipid-vldl',
    canonical_name: 'vldl_cholesterol',
    display_name: 'VLDL Cholesterol',
    aliases: ['VLDL', 'Very Low-Density Lipoprotein'],
    category: 'Lipids',
    normal_range_male: '2–30 mg/dL',
    normal_range_female: '2–30 mg/dL',
    description:
      'VLDL is a lipoprotein that the liver makes to carry triglycerides to tissues for energy or storage. VLDL is calculated as one-fifth of triglycerides in most reports. High VLDL is closely tied to high triglycerides and contributes to arterial plaque formation. It is a component of the atherogenic lipid pattern associated with metabolic syndrome.',
    causes_high: ['High triglycerides (same causes)', 'Metabolic syndrome', 'Diabetes', 'Obesity'],
    causes_low: ['Low triglycerides', 'Malnutrition'],
  },

  // ─── Liver Function ─────────────────────────────────────────────────────────

  {
    id: 'bm-9',
    canonical_name: 'alt_sgpt',
    display_name: 'ALT (SGPT)',
    aliases: ['SGPT', 'Alanine Aminotransferase', 'GPT', 'ALT'],
    category: 'Liver',
    normal_range_male: '7–56 U/L',
    normal_range_female: '7–45 U/L',
    description:
      'ALT (Alanine Transaminase, also called SGPT) is an enzyme that lives mainly inside liver cells. When liver cells are damaged or inflamed, ALT leaks into the bloodstream and the blood level rises. It is the single most specific blood test for liver cell injury and is used to diagnose fatty liver disease (NAFLD), hepatitis, and medication-related liver damage.',
    causes_high: ['Fatty liver disease (NAFLD/NASH)', 'Viral hepatitis (A, B, C)', 'Alcohol overuse', 'Certain medications (statins, paracetamol)', 'Obesity'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-10',
    canonical_name: 'ast_sgot',
    display_name: 'AST (SGOT)',
    aliases: ['SGOT', 'Aspartate Aminotransferase', 'GOT', 'AST'],
    category: 'Liver',
    normal_range_male: '10–40 U/L',
    normal_range_female: '10–35 U/L',
    description:
      'AST (Aspartate Transaminase, also called SGOT) is found in the liver, heart, muscles, and kidneys. Because it is not liver-specific, it is always interpreted alongside ALT. An AST/ALT ratio above 2 strongly suggests alcoholic liver disease. AST also rises with heart attacks and muscle damage, which can confuse interpretation.',
    causes_high: ['Liver disease', 'Heart attack (myocardial infarction)', 'Muscle injury', 'Strenuous exercise', 'Alcohol use'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-alp',
    canonical_name: 'alkaline_phosphatase',
    display_name: 'Alkaline Phosphatase (ALP)',
    aliases: ['ALP', 'Alk Phos', 'ALKP'],
    category: 'Liver',
    normal_range_male: '40–130 U/L',
    normal_range_female: '35–105 U/L',
    description:
      'ALP is an enzyme found in the liver (bile ducts), bone, kidneys, and intestines. In adults, high ALP most commonly signals bile duct blockage (cholestasis) — when bile cannot flow freely from the liver. It is also elevated in bone disorders because bone cells produce ALP during active bone formation. ALP is naturally higher in children (growing bones) and during pregnancy.',
    causes_high: ['Bile duct blockage (gallstones, tumour)', 'Fatty liver disease', 'Bone diseases (Paget\'s, bone metastases)', 'Liver cirrhosis', 'Vitamin D deficiency', 'Pregnancy (normal in third trimester)'],
    causes_low: ['Malnutrition', 'Hypothyroidism', 'Pernicious anaemia', 'Zinc deficiency'],
  },
  {
    id: 'bm-ggt',
    canonical_name: 'gamma_glutamyl_transferase',
    display_name: 'GGT (Gamma-Glutamyl Transferase)',
    aliases: ['GGT', 'GGTP', 'Gamma GT'],
    category: 'Liver',
    normal_range_male: '10–71 U/L',
    normal_range_female: '6–42 U/L',
    description:
      'GGT is a liver enzyme that is exquisitely sensitive to alcohol use — even moderate drinking raises it. It is found in liver cells and bile ducts. When elevated alongside ALP, it confirms the source is the liver (not bone). GGT is used as an early warning for alcohol-related liver damage, fatty liver, and bile duct problems.',
    causes_high: ['Alcohol consumption (most sensitive marker)', 'Fatty liver disease', 'Liver cirrhosis', 'Bile duct blockage', 'Certain medications (phenytoin, barbiturates)', 'Obesity'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-bilirubin-total',
    canonical_name: 'total_bilirubin',
    display_name: 'Total Bilirubin',
    aliases: ['T. Bil', 'Serum Bilirubin', 'Bilirubin Total'],
    category: 'Liver',
    normal_range_male: '0.2–1.2 mg/dL',
    normal_range_female: '0.2–1.2 mg/dL',
    description:
      'Bilirubin is a yellow pigment produced when red blood cells are broken down. The liver processes it and excretes it in bile. When it builds up in the blood, it causes jaundice (yellow eyes and skin). Total bilirubin = direct (conjugated) + indirect (unconjugated). The ratio helps pinpoint whether the problem is in red blood cell breakdown, liver processing, or bile flow.',
    causes_high: ['Liver disease (hepatitis, cirrhosis)', 'Bile duct blockage', 'Haemolysis (excessive red cell breakdown)', 'Gilbert\'s syndrome (benign)', 'Neonatal jaundice'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-bilirubin-direct',
    canonical_name: 'direct_bilirubin',
    display_name: 'Direct Bilirubin',
    aliases: ['Conjugated Bilirubin', 'D. Bili'],
    category: 'Liver',
    normal_range_male: '0–0.3 mg/dL',
    normal_range_female: '0–0.3 mg/dL',
    description:
      'Direct (conjugated) bilirubin is the water-soluble form that the liver has already processed. A raised direct bilirubin means the problem is downstream — either the liver is struggling to excrete it, or the bile duct is blocked (cholestasis). It is used to distinguish obstructive jaundice from haemolytic jaundice.',
    causes_high: ['Bile duct obstruction (gallstones, cancer)', 'Hepatitis', 'Liver cirrhosis', 'Primary biliary cholangitis'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-albumin',
    canonical_name: 'albumin',
    display_name: 'Albumin',
    aliases: ['Serum Albumin'],
    category: 'Liver',
    normal_range_male: '3.5–5.0 g/dL',
    normal_range_female: '3.5–5.0 g/dL',
    description:
      'Albumin is the most abundant protein in blood, made exclusively by the liver. It keeps fluid from leaking out of blood vessels, transports hormones, vitamins, and drugs, and reflects the liver\'s synthetic capacity. Because it has a long half-life (~20 days), low albumin signals chronic liver dysfunction, malnutrition, or persistent protein loss — not acute disease.',
    causes_high: ['Dehydration (relative elevation)'],
    causes_low: ['Liver cirrhosis', 'Malnutrition', 'Kidney disease (nephrotic syndrome — protein leakage)', 'Severe burns', 'Chronic inflammation', 'Inflammatory bowel disease'],
  },
  {
    id: 'bm-total-protein',
    canonical_name: 'total_protein',
    display_name: 'Total Protein',
    aliases: ['TP', 'Serum Total Protein'],
    category: 'Liver',
    normal_range_male: '6.0–8.3 g/dL',
    normal_range_female: '6.0–8.3 g/dL',
    description:
      'Total protein in blood is the sum of albumin and globulins (including antibodies). It reflects overall nutritional status and liver synthetic function. Low total protein suggests malnutrition, liver disease, or protein-losing conditions. Very high total protein may indicate a plasma cell disorder (myeloma) or chronic infection with elevated immunoglobulins.',
    causes_high: ['Dehydration', 'Chronic infections', 'Multiple myeloma', 'Autoimmune diseases'],
    causes_low: ['Malnutrition', 'Liver disease', 'Kidney disease (nephrotic syndrome)', 'Burns', 'Gastrointestinal protein loss'],
  },

  // ─── Kidney ─────────────────────────────────────────────────────────────────

  {
    id: 'bm-11',
    canonical_name: 'serum_creatinine',
    display_name: 'Serum Creatinine',
    aliases: ['Creatinine', 'S. Creatinine'],
    category: 'Kidney',
    normal_range_male: '0.7–1.2 mg/dL',
    normal_range_female: '0.5–1.1 mg/dL',
    description:
      'Creatinine is a waste product generated from normal muscle metabolism. It is freely filtered by the kidneys; when kidneys are healthy, creatinine is constantly cleared from the blood. Rising creatinine means the kidneys are filtering less efficiently. Since creatinine levels are influenced by muscle mass (higher in muscular or male individuals), it is always interpreted with eGFR and urea.',
    causes_high: ['Chronic kidney disease', 'Dehydration', 'High protein diet', 'Intense exercise (transient)', 'Certain medications (NSAIDs, ACE inhibitors)', 'Rhabdomyolysis'],
    causes_low: ['Low muscle mass', 'Malnutrition', 'Liver disease', 'Pregnancy'],
  },
  {
    id: 'bm-12',
    canonical_name: 'blood_urea_nitrogen',
    display_name: 'Blood Urea Nitrogen (BUN)',
    aliases: ['BUN', 'Serum Urea', 'Blood Urea'],
    category: 'Kidney',
    normal_range_male: '7–20 mg/dL',
    normal_range_female: '7–20 mg/dL',
    description:
      'Urea (measured as BUN) is the end-product of protein breakdown. The liver makes it from ammonia; the kidneys filter and excrete it. Rising BUN indicates either reduced kidney filtering, dehydration, or excessive protein breakdown. The BUN-to-creatinine ratio helps distinguish kidney disease from dehydration or GI bleeding.',
    causes_high: ['Kidney disease', 'Dehydration', 'High protein intake', 'Upper GI bleeding', 'Heart failure', 'Catabolic states'],
    causes_low: ['Low protein diet', 'Liver failure', 'Overhydration', 'Malnutrition', 'Pregnancy'],
  },
  {
    id: 'bm-egfr',
    canonical_name: 'egfr',
    display_name: 'eGFR (Estimated Glomerular Filtration Rate)',
    aliases: ['eGFR', 'GFR', 'Estimated GFR'],
    category: 'Kidney',
    normal_range_male: 'Above 90 mL/min/1.73m²',
    normal_range_female: 'Above 90 mL/min/1.73m²',
    description:
      'eGFR estimates how well your kidneys are filtering blood every minute, calculated from creatinine, age, sex, and sometimes race. It is the best overall measure of kidney function. Values below 60 for 3+ months indicate chronic kidney disease (CKD). The staging of CKD (G1–G5) is based entirely on eGFR. Early detection allows interventions that can slow kidney decline significantly.',
    causes_high: ['Generally not a concern — higher is better'],
    causes_low: ['Chronic kidney disease', 'Dehydration', 'Heart failure', 'Diabetes (diabetic nephropathy)', 'Hypertension (hypertensive nephropathy)', 'Glomerulonephritis'],
  },
  {
    id: 'bm-uric-acid',
    canonical_name: 'uric_acid',
    display_name: 'Uric Acid',
    aliases: ['Serum Uric Acid', 'SUA'],
    category: 'Kidney',
    normal_range_male: '3.4–7.0 mg/dL',
    normal_range_female: '2.4–6.0 mg/dL',
    description:
      'Uric acid is the end-product of purine breakdown (from DNA and certain foods). The kidneys normally filter it, but if production is excessive or excretion is inadequate, uric acid crystals can deposit in joints causing gout, or in kidneys causing kidney stones. Hyperuricaemia is closely linked to metabolic syndrome, hypertension, and kidney disease.',
    causes_high: ['Gout', 'High purine diet (red meat, seafood, alcohol)', 'Kidney disease', 'Metabolic syndrome', 'Diuretics', 'Rapid cell turnover (leukaemia, chemotherapy)'],
    causes_low: ['Low purine diet', 'Certain medications (allopurinol)', 'Wilson\'s disease', 'Liver disease'],
  },

  // ─── Iron Studies ───────────────────────────────────────────────────────────

  {
    id: 'bm-iron-serum',
    canonical_name: 'serum_iron',
    display_name: 'Serum Iron',
    aliases: ['Iron', 'Fe', 'S. Iron'],
    category: 'Blood',
    normal_range_male: '60–170 µg/dL',
    normal_range_female: '50–170 µg/dL',
    description:
      'Serum iron measures the amount of iron circulating in the blood bound to transferrin (the transport protein). It fluctuates widely throughout the day and is affected by recent meals, so it is never interpreted alone — always alongside TIBC and ferritin for a complete picture of iron status.',
    causes_high: ['Iron overload (haemochromatosis)', 'Haemolytic anaemia', 'Liver damage', 'Repeated blood transfusions', 'Excessive iron supplements'],
    causes_low: ['Iron deficiency anaemia', 'Chronic inflammation', 'Chronic blood loss', 'Malnutrition', 'Poor absorption'],
  },
  {
    id: 'bm-tibc',
    canonical_name: 'tibc',
    display_name: 'TIBC (Total Iron Binding Capacity)',
    aliases: ['TIBC', 'Total Iron Binding Capacity'],
    category: 'Blood',
    normal_range_male: '240–450 µg/dL',
    normal_range_female: '240–450 µg/dL',
    description:
      'TIBC measures the blood\'s maximum capacity to bind and transport iron — essentially how many "empty seats" are on transferrin proteins. In iron deficiency, the body makes more transferrin to scavenge every bit of available iron, so TIBC goes up. In iron overload, transferrin is already saturated, so TIBC goes down. The transferrin saturation (serum iron ÷ TIBC × 100) is a key ratio.',
    causes_high: ['Iron deficiency anaemia', 'Pregnancy', 'Oral contraceptive use'],
    causes_low: ['Iron overload', 'Malnutrition', 'Liver disease', 'Chronic inflammation', 'Haemolytic anaemia'],
  },
  {
    id: 'bm-ferritin',
    canonical_name: 'ferritin',
    display_name: 'Ferritin',
    aliases: ['Serum Ferritin'],
    category: 'Blood',
    normal_range_male: '30–300 ng/mL',
    normal_range_female: '13–150 ng/mL',
    description:
      'Ferritin is the primary iron storage protein inside cells. Serum ferritin reflects the body\'s total iron reserves. It is the most sensitive single test for iron deficiency — levels fall before haemoglobin drops. However, ferritin is also an acute-phase reactant, meaning it rises with infection, inflammation, and liver disease, which can mask true iron deficiency.',
    causes_high: ['Iron overload (haemochromatosis)', 'Liver disease', 'Chronic inflammation (arthritis, IBD)', 'Infections', 'Malignancy', 'Metabolic syndrome'],
    causes_low: ['Iron deficiency anaemia', 'Malnutrition', 'Heavy menstrual bleeding', 'Pregnancy', 'Vegetarian diet with poor iron absorption'],
  },

  // ─── Electrolytes ───────────────────────────────────────────────────────────

  {
    id: 'bm-sodium',
    canonical_name: 'serum_sodium',
    display_name: 'Sodium',
    aliases: ['Na', 'Serum Sodium', 'S. Sodium'],
    category: 'Electrolytes',
    normal_range_male: '136–145 mEq/L',
    normal_range_female: '136–145 mEq/L',
    description:
      'Sodium is the main electrolyte in blood and body fluids outside cells. It controls fluid balance, blood pressure, and nerve and muscle function. The kidneys and hormones (ADH, aldosterone) precisely regulate sodium. Abnormal sodium is usually a problem of water balance rather than sodium itself — too much water dilutes sodium (hyponatraemia); too little water concentrates it (hypernatraemia).',
    causes_high: ['Dehydration', 'Excessive salt intake', 'Diabetes insipidus', 'Conn\'s syndrome (excess aldosterone)', 'Certain medications'],
    causes_low: ['Over-hydration', 'Vomiting and diarrhoea', 'Diuretic use', 'Heart, liver, or kidney failure', 'Hypothyroidism', 'SIADH'],
  },
  {
    id: 'bm-potassium',
    canonical_name: 'serum_potassium',
    display_name: 'Potassium',
    aliases: ['K', 'Serum Potassium', 'S. Potassium'],
    category: 'Electrolytes',
    normal_range_male: '3.5–5.1 mEq/L',
    normal_range_female: '3.5–5.1 mEq/L',
    description:
      'Potassium is the main electrolyte inside cells and is critical for heart rhythm and muscle contraction. Even small deviations outside the normal range can cause life-threatening cardiac arrhythmias. The kidneys tightly regulate potassium. Diuretics and ACE inhibitors (common in hypertension treatment) are frequent causes of abnormal potassium in urban Indians.',
    causes_high: ['Kidney failure', 'ACE inhibitors / potassium-sparing diuretics', 'Excess supplementation', 'Addison\'s disease', 'Tissue breakdown (rhabdomyolysis)'],
    causes_low: ['Diuretics (thiazide, loop)', 'Vomiting and diarrhoea', 'Low dietary intake', 'Excessive sweating', 'Insulin use', 'Magnesium deficiency'],
  },
  {
    id: 'bm-calcium',
    canonical_name: 'serum_calcium',
    display_name: 'Serum Calcium',
    aliases: ['Ca', 'S. Calcium', 'Total Calcium'],
    category: 'Electrolytes',
    normal_range_male: '8.6–10.2 mg/dL',
    normal_range_female: '8.6–10.2 mg/dL',
    description:
      'Calcium is essential for bone strength, muscle contraction (including heartbeat), nerve signalling, and blood clotting. About 99% of the body\'s calcium is in bones; the 1% in blood is precisely controlled by parathyroid hormone (PTH) and vitamin D. High blood calcium (hypercalcaemia) and very low calcium (hypocalcaemia) are both medical emergencies.',
    causes_high: ['Hyperparathyroidism (overactive parathyroid)', 'Malignancy (bone metastases)', 'Vitamin D toxicity', 'Sarcoidosis', 'Thiazide diuretics', 'Immobilisation'],
    causes_low: ['Vitamin D deficiency', 'Hypoparathyroidism', 'Magnesium deficiency', 'Kidney disease', 'Pancreatitis', 'Malabsorption'],
  },
  {
    id: 'bm-phosphorus',
    canonical_name: 'serum_phosphorus',
    display_name: 'Serum Phosphorus',
    aliases: ['Phosphate', 'S. Phosphorus', 'Inorganic Phosphate', 'PO4'],
    category: 'Electrolytes',
    normal_range_male: '2.5–4.5 mg/dL',
    normal_range_female: '2.5–4.5 mg/dL',
    description:
      'Phosphorus (as phosphate) is essential for bone mineralisation alongside calcium, energy production (ATP), and cell membrane structure. It is regulated together with calcium by PTH and vitamin D. Abnormalities often accompany kidney disease, parathyroid disorders, or nutritional deficiencies.',
    causes_high: ['Kidney failure', 'Hypoparathyroidism', 'Excess vitamin D', 'Rhabdomyolysis', 'Acidosis'],
    causes_low: ['Malnutrition', 'Vitamin D deficiency', 'Hyperparathyroidism', 'Alcohol use disorder', 'Antacid overuse (binding phosphate)'],
  },

  // ─── Inflammatory Markers ───────────────────────────────────────────────────

  {
    id: 'bm-crp',
    canonical_name: 'c_reactive_protein',
    display_name: 'CRP (C-Reactive Protein)',
    aliases: ['CRP', 'C-Reactive Protein', 'Serum CRP'],
    category: 'Inflammatory',
    normal_range_male: 'Below 5 mg/L',
    normal_range_female: 'Below 5 mg/L',
    description:
      'CRP is a protein made by the liver in response to inflammation — it rises sharply (100-fold or more) within hours of bacterial infection or tissue injury. It is used to detect and monitor active infections, flare-ups of inflammatory diseases (such as rheumatoid arthritis or IBD), and post-surgical recovery. A normal CRP is reassuring that there is no major active infection.',
    causes_high: ['Bacterial infections', 'Viral infections (moderate rise)', 'Inflammatory diseases (RA, IBD)', 'Heart attack', 'Burns or injury', 'Cancer'],
    causes_low: ['Generally not clinically significant (low is good)'],
  },
  {
    id: 'bm-hs-crp',
    canonical_name: 'hs_crp',
    display_name: 'hs-CRP (High-Sensitivity CRP)',
    aliases: ['hs-CRP', 'High Sensitivity CRP', 'hsCRP', 'Cardiac CRP'],
    category: 'Inflammatory',
    normal_range_male: 'Below 1 mg/L (low risk)',
    normal_range_female: 'Below 1 mg/L (low risk)',
    description:
      'hs-CRP uses a more sensitive version of the CRP test to detect low-grade chronic inflammation in the blood vessel walls. This chronic inflammation is a key driver of atherosclerosis (arterial plaque build-up) and heart attacks. Levels of 1–3 mg/L indicate average risk; above 3 mg/L indicates high risk for cardiovascular events — even in people with normal cholesterol.',
    causes_high: ['Chronic low-grade inflammation', 'Obesity', 'Smoking', 'Sedentary lifestyle', 'Metabolic syndrome', 'Gum disease (periodontitis)', 'Chronic stress'],
    causes_low: ['Generally not clinically significant'],
  },
  {
    id: 'bm-esr',
    canonical_name: 'esr',
    display_name: 'ESR (Erythrocyte Sedimentation Rate)',
    aliases: ['ESR', 'Erythrocyte Sedimentation Rate', 'Sed Rate', 'Westergren ESR'],
    category: 'Inflammatory',
    normal_range_male: '0–20 mm/hr',
    normal_range_female: '0–30 mm/hr',
    description:
      'ESR measures how quickly red blood cells settle to the bottom of a test tube. When inflammation is present, proteins that promote clumping cause cells to fall faster. ESR is a non-specific test — it is elevated in almost any inflammatory, infectious, or cancerous condition, but it is also a useful screening tool and monitoring marker for conditions like tuberculosis, rheumatoid arthritis, and temporal arteritis.',
    causes_high: ['Infections (TB, bacterial)', 'Autoimmune diseases (RA, lupus)', 'Anaemia', 'Kidney disease', 'Cancer', 'Pregnancy'],
    causes_low: ['Polycythaemia vera', 'Sickle cell anaemia', 'Heart failure (can be low or normal)'],
  },

  // ─── Hormones ───────────────────────────────────────────────────────────────

  {
    id: 'bm-testosterone',
    canonical_name: 'testosterone',
    display_name: 'Testosterone (Total)',
    aliases: ['Serum Testosterone', 'Total Testosterone', 'T'],
    category: 'Hormones',
    normal_range_male: '300–1,000 ng/dL',
    normal_range_female: '15–70 ng/dL',
    description:
      'Testosterone is the primary male sex hormone, produced mainly in the testes (in men) and in smaller amounts by the adrenal glands and ovaries (in women). It drives muscle mass, bone density, libido, red blood cell production, and energy levels. In men, chronically low testosterone (hypogonadism) causes fatigue, low mood, and decreased sexual function; in women, very high levels can suggest PCOS.',
    causes_high: ['Polycystic ovary syndrome (PCOS, in women)', 'Anabolic steroid use', 'Adrenal tumours', 'Testicular tumours'],
    causes_low: ['Hypogonadism', 'Chronic illness', 'Obesity', 'Ageing (gradual decline after 30)', 'Pituitary disorders', 'Chronic stress', 'Opioid use'],
  },
  {
    id: 'bm-prolactin',
    canonical_name: 'prolactin',
    display_name: 'Prolactin',
    aliases: ['Serum Prolactin', 'PRL'],
    category: 'Hormones',
    normal_range_male: '4–15 ng/mL',
    normal_range_female: '4–23 ng/mL (higher in pregnancy/breastfeeding)',
    description:
      'Prolactin is produced by the pituitary gland and is best known for stimulating breast milk production. Outside of pregnancy and breastfeeding, high prolactin (hyperprolactinaemia) suppresses reproductive hormones, causing irregular periods in women and low testosterone in men. A small benign tumour called a prolactinoma is the most common cause of persistently high prolactin.',
    causes_high: ['Pregnancy and breastfeeding (normal)', 'Prolactinoma (pituitary tumour)', 'Hypothyroidism', 'Antipsychotic medications', 'Stress or exercise (transient)', 'Kidney failure'],
    causes_low: ['Pituitary damage or Sheehan\'s syndrome', 'Generally not clinically significant if mildly low'],
  },
  {
    id: 'bm-fsh',
    canonical_name: 'fsh',
    display_name: 'FSH (Follicle Stimulating Hormone)',
    aliases: ['FSH', 'Follicle Stimulating Hormone'],
    category: 'Hormones',
    normal_range_male: '1.5–12.4 mIU/mL',
    normal_range_female: '3.5–12.5 mIU/mL (follicular phase)',
    description:
      'FSH is produced by the pituitary gland and drives ovarian follicle development in women and sperm production in men. In women, high FSH (particularly on Day 2–3 of the cycle) indicates diminished ovarian reserve and is used in fertility evaluation. In both sexes, very high FSH combined with low sex hormones confirms primary gonadal failure (menopause or Klinefelter\'s syndrome).',
    causes_high: ['Menopause / perimenopause', 'Diminished ovarian reserve', 'Primary ovarian insufficiency', 'Klinefelter\'s syndrome (males)', 'Gonadal damage from chemotherapy'],
    causes_low: ['Pituitary or hypothalamic dysfunction', 'Hyperprolactinaemia', 'Severe underweight or anorexia', 'Steroid use'],
  },
  {
    id: 'bm-lh',
    canonical_name: 'lh',
    display_name: 'LH (Luteinising Hormone)',
    aliases: ['LH', 'Luteinising Hormone', 'Luteinizing Hormone'],
    category: 'Hormones',
    normal_range_male: '1.7–8.6 mIU/mL',
    normal_range_female: '2.4–12.6 mIU/mL (follicular phase)',
    description:
      'LH is released by the pituitary and triggers ovulation in women (the mid-cycle LH surge) and stimulates testosterone production in men. LH and FSH are measured together to assess the pituitary-gonadal axis. A high LH:FSH ratio (above 2:1) is characteristic of polycystic ovary syndrome (PCOS), a very common endocrine disorder in Indian women.',
    causes_high: ['PCOS (high LH:FSH ratio)', 'Menopause', 'Primary gonadal failure', 'LH-secreting pituitary tumours'],
    causes_low: ['Pituitary failure', 'Hypothalamic amenorrhoea', 'Hyperprolactinaemia', 'Severe caloric restriction', 'Stress'],
  },
  {
    id: 'bm-cortisol',
    canonical_name: 'cortisol',
    display_name: 'Cortisol',
    aliases: ['Serum Cortisol', 'AM Cortisol'],
    category: 'Hormones',
    normal_range_male: '6–23 µg/dL (morning)',
    normal_range_female: '6–23 µg/dL (morning)',
    description:
      'Cortisol is the primary stress hormone, made by the adrenal glands in response to physical or psychological stress, illness, or low blood sugar. It follows a diurnal rhythm — highest in the morning (8 AM), lowest at midnight. Chronically elevated cortisol (Cushing\'s syndrome) causes weight gain, high blood pressure, and diabetes; very low cortisol (Addison\'s disease) causes life-threatening salt and water imbalance.',
    causes_high: ['Cushing\'s syndrome or disease', 'Chronic psychological stress', 'Obesity', 'Steroid medications', 'Alcoholism', 'Acute illness (physiological)'],
    causes_low: ['Addison\'s disease (adrenal insufficiency)', 'Pituitary failure', 'Long-term steroid use followed by sudden discontinuation'],
  },

]

const byCanonical = new Map<string, BiomarkerEntry>()
for (const e of ENTRIES) {
  byCanonical.set(e.canonical_name, e)
}

// Maps common canonical name variants returned by the AI pipeline → the catalog key.
// Allows the catalog to match even if the analyser uses a slightly different normalisation.
const CANONICAL_ALIASES: Record<string, string> = {
  // Haemoglobin
  hemoglobin: 'haemoglobin',
  hb: 'haemoglobin',
  hgb: 'haemoglobin',
  // CBC
  wbc: 'total_leukocyte_count',
  tlc: 'total_leukocyte_count',
  white_blood_cell_count: 'total_leukocyte_count',
  leukocyte_count: 'total_leukocyte_count',
  rbc: 'rbc_count',
  red_blood_cells: 'rbc_count',
  hct: 'packed_cell_volume',
  haematocrit: 'packed_cell_volume',
  hematocrit: 'packed_cell_volume',
  pcv: 'packed_cell_volume',
  // Liver enzymes
  alt: 'alt_sgpt',
  sgpt: 'alt_sgpt',
  alanine_aminotransferase: 'alt_sgpt',
  ast: 'ast_sgot',
  sgot: 'ast_sgot',
  aspartate_aminotransferase: 'ast_sgot',
  alp: 'alkaline_phosphatase',
  alk_phos: 'alkaline_phosphatase',
  ggt: 'gamma_glutamyl_transferase',
  ggtp: 'gamma_glutamyl_transferase',
  gamma_gt: 'gamma_glutamyl_transferase',
  // Bilirubin
  bilirubin: 'total_bilirubin',
  bilirubin_total: 'total_bilirubin',
  direct_bili: 'direct_bilirubin',
  conjugated_bilirubin: 'direct_bilirubin',
  serum_albumin: 'albumin',
  // Kidney
  creatinine: 'serum_creatinine',
  s_creatinine: 'serum_creatinine',
  bun: 'blood_urea_nitrogen',
  serum_urea: 'blood_urea_nitrogen',
  blood_urea: 'blood_urea_nitrogen',
  urea: 'blood_urea_nitrogen',
  gfr: 'egfr',
  estimated_gfr: 'egfr',
  uric_acid: 'uric_acid',
  s_uric_acid: 'uric_acid',
  serum_uric_acid: 'uric_acid',
  // Lipids
  cholesterol: 'total_cholesterol',
  serum_cholesterol: 'total_cholesterol',
  ldl: 'ldl_cholesterol',
  low_density_lipoprotein: 'ldl_cholesterol',
  hdl: 'hdl_cholesterol',
  high_density_lipoprotein: 'hdl_cholesterol',
  tg: 'triglycerides',
  serum_triglycerides: 'triglycerides',
  vldl: 'vldl_cholesterol',
  // Thyroid
  thyroid_stimulating_hormone: 'tsh',
  free_t4: 't4_free',
  ft4: 't4_free',
  free_thyroxine: 't4_free',
  t4: 't4_total',
  total_thyroxine: 't4_total',
  t3: 't3_total',
  total_t3: 't3_total',
  free_t3: 't3_free',
  ft3: 't3_free',
  tpo_antibody: 'anti_tpo',
  anti_thyroid_peroxidase: 'anti_tpo',
  // Iron
  iron: 'serum_iron',
  fe: 'serum_iron',
  total_iron_binding_capacity: 'tibc',
  serum_ferritin: 'ferritin',
  // Electrolytes
  sodium: 'serum_sodium',
  na: 'serum_sodium',
  potassium: 'serum_potassium',
  k: 'serum_potassium',
  calcium: 'serum_calcium',
  ca: 'serum_calcium',
  phosphorus: 'serum_phosphorus',
  phosphate: 'serum_phosphorus',
  inorganic_phosphate: 'serum_phosphorus',
  // Inflammatory
  crp: 'c_reactive_protein',
  c_reactive_protein: 'c_reactive_protein',
  high_sensitivity_crp: 'hs_crp',
  hsCRP: 'hs_crp',
  erythrocyte_sedimentation_rate: 'esr',
  sed_rate: 'esr',
  // Diabetes
  pp_blood_sugar: 'post_prandial_glucose',
  ppbs: 'post_prandial_glucose',
  post_prandial_blood_sugar: 'post_prandial_glucose',
  pp_glucose: 'post_prandial_glucose',
  fbs: 'serum_glucose_fasting',
  fasting_glucose: 'serum_glucose_fasting',
  blood_glucose_fasting: 'serum_glucose_fasting',
  a1c: 'hba1c',
  glycated_haemoglobin: 'hba1c',
  glycated_hemoglobin: 'hba1c',
  glycosylated_haemoglobin: 'hba1c',
  // Vitamins
  vit_d: 'vitamin_d',
  vit_d3: 'vitamin_d',
  '25_oh_d': 'vitamin_d',
  '25_hydroxyvitamin_d': 'vitamin_d',
  vit_b12: 'vitamin_b12',
  b12: 'vitamin_b12',
  cobalamin: 'vitamin_b12',
  // Hormones
  serum_testosterone: 'testosterone',
  serum_prolactin: 'prolactin',
  prl: 'prolactin',
  follicle_stimulating_hormone: 'fsh',
  luteinising_hormone: 'lh',
  luteinizing_hormone: 'lh',
  serum_cortisol: 'cortisol',
  am_cortisol: 'cortisol',
}

export function getCatalogEntry(canonicalName: string): BiomarkerEntry | undefined {
  const lower = canonicalName.toLowerCase()
  return byCanonical.get(lower)
    ?? byCanonical.get(CANONICAL_ALIASES[lower] ?? '')
    ?? undefined
}

/** Canonical names present in the curated reference (for "also in your data"). */
export const allCatalogCanonicals: ReadonlySet<string> = new Set(ENTRIES.map((e) => e.canonical_name))

export function listCatalogEntries(): readonly BiomarkerEntry[] {
  return ENTRIES
}
