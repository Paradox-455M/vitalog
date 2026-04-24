import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type {
  FamilyMember,
  CreateFamilyMemberRequest,
  UpdateFamilyMemberRequest,
} from '../lib/api'

interface UseFamilyMembersResult {
  members: FamilyMember[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  create: (data: CreateFamilyMemberRequest) => Promise<FamilyMember>
  update: (id: string, data: UpdateFamilyMemberRequest) => Promise<FamilyMember>
  remove: (id: string) => Promise<void>
  creating: boolean
  updating: boolean
  deleting: boolean
}

export function useFamilyMembers(): UseFamilyMembersResult {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['family'],
    queryFn: () => api.family.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateFamilyMemberRequest) => api.family.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFamilyMemberRequest }) =>
      api.family.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.family.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['family'] }),
  })

  const create = async (data: CreateFamilyMemberRequest): Promise<FamilyMember> => {
    try {
      return await createMutation.mutateAsync(data)
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Failed to create family member')
    }
  }

  const update = async (id: string, data: UpdateFamilyMemberRequest): Promise<FamilyMember> => {
    try {
      return await updateMutation.mutateAsync({ id, data })
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Failed to update family member')
    }
  }

  const remove = async (id: string): Promise<void> => {
    try {
      await deleteMutation.mutateAsync(id)
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Failed to delete family member')
    }
  }

  return {
    members,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
    create,
    update,
    remove,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    deleting: deleteMutation.isPending,
  }
}
