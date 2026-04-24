export interface InsightCard {
  id: string
  category: 'nutrition' | 'lifestyle' | 'medical' | 'trend'
  headline: string
  context: string
  document_id: string
  created_at: string
}

export interface ActionItem {
  id: string
  type: 'diet' | 'exercise' | 'doctor'
  action: string
  sub_note: string
}
