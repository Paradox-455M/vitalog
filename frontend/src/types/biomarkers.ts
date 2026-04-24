export type BiomarkerCategory =
  | 'Blood'
  | 'Metabolic'
  | 'Thyroid'
  | 'Vitamins'
  | 'Liver'
  | 'Kidney'
  | 'Lipids'
  | 'Electrolytes'
  | 'Inflammatory'
  | 'Hormones'
  | 'Other'

export interface BiomarkerEntry {
  id: string
  canonical_name: string
  display_name: string
  aliases: string[]
  category: BiomarkerCategory
  normal_range_male: string
  normal_range_female: string
  description: string
  causes_high: string[]
  causes_low: string[]
}
