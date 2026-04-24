import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { NotificationListItem } from '../lib/api'

export function useNotifications(options?: { limit?: number; loadOnMount?: boolean }) {
  const limit = options?.limit ?? 20
  const loadOnMount = options?.loadOnMount ?? true
  const queryClient = useQueryClient()

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => api.notifications.list({ limit }),
    enabled: loadOnMount,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const items: NotificationListItem[] = data?.items ?? []
  const unreadCount = data?.unread_count ?? 0
  const nextCursor = data?.next_cursor ?? null

  return {
    items,
    unreadCount,
    nextCursor,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
    markRead: (id: string) => markReadMutation.mutateAsync(id),
    markAllRead: () => markAllReadMutation.mutateAsync(),
  }
}
