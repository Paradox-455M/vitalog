import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ProfileWithDocCount, UpdateProfileRequest } from '../lib/api'

interface UseProfileResult {
  profile: ProfileWithDocCount | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  update: (data: UpdateProfileRequest) => Promise<void>
  updating: boolean
}

export function useProfile(): UseProfileResult {
  const queryClient = useQueryClient()

  const { data: profile = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.profile.get(),
  })

  const { mutateAsync, isPending: updating } = useMutation({
    mutationFn: (data: UpdateProfileRequest) => api.profile.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProfileWithDocCount>(['profile'], (prev) =>
        prev ? { ...prev, ...updated, document_count: prev.document_count } : undefined
      )
    },
  })

  const update = async (data: UpdateProfileRequest) => {
    try {
      await mutateAsync(data)
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Failed to update profile')
    }
  }

  return {
    profile,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
    update,
    updating,
  }
}

export function useIsPro(): boolean {
  const { profile } = useProfile()
  return profile?.plan === 'pro'
}

/** Max saved reports on free tier; keep in sync with backend `freeTierMaxDocuments`. */
export const FREE_TIER_MAX_DOCUMENTS = 3

const FREE_LIMITS = {
  maxUploads: FREE_TIER_MAX_DOCUMENTS,
  maxFamilyMembers: 1,
}

export function useUploadLimit(): {
  canUpload: boolean
  uploadsRemaining: number
  isAtLimit: boolean
} {
  const { profile } = useProfile()

  if (!profile) {
    return { canUpload: false, uploadsRemaining: 0, isAtLimit: false }
  }

  if (profile.plan === 'pro') {
    return { canUpload: true, uploadsRemaining: Infinity, isAtLimit: false }
  }

  const remaining = Math.max(0, FREE_LIMITS.maxUploads - profile.document_count)
  return {
    canUpload: remaining > 0,
    uploadsRemaining: remaining,
    isAtLimit: remaining === 0,
  }
}
