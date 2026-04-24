import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { HealthValue, TimelineData } from '../lib/api'

interface UseHealthValuesOptions {
  familyMemberId?: string
  canonicalName?: string
  fromDate?: string
  toDate?: string
}

interface UseHealthValuesResult {
  healthValues: HealthValue[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useHealthValues(options?: UseHealthValuesOptions): UseHealthValuesResult {
  const { data: healthValues = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['health-values', options?.familyMemberId, options?.canonicalName, options?.fromDate, options?.toDate],
    queryFn: () => api.healthValues.list({
      family_member_id: options?.familyMemberId,
      canonical_name: options?.canonicalName,
      from_date: options?.fromDate,
      to_date: options?.toDate,
    }),
  })

  return {
    healthValues,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
  }
}

interface UseTimelineResult {
  timeline: TimelineData | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useTimeline(
  canonicalName: string | undefined,
  familyMemberId?: string
): UseTimelineResult {
  const { data: timeline = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['timeline', canonicalName, familyMemberId],
    queryFn: () => api.healthValues.timeline(canonicalName!, familyMemberId),
    enabled: !!canonicalName,
  })

  return {
    timeline,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
  }
}
