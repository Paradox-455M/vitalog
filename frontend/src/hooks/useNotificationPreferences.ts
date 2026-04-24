import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { NotificationPreferences } from '../lib/api'

function defaultPrefs(): NotificationPreferences {
  return {
    new_report: true,
    trend_detected: true,
    family_updates: false,
    health_tips: true,
    email: true,
    push: true,
    whatsapp: false,
    tone: 'soft',
  }
}

export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const { data: saved, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => api.notificationPreferences.get(),
  })

  // Local editing state separate from server state (form pattern)
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (saved) setPrefs(saved) }, [saved])

  const { mutateAsync, isPending: saving } = useMutation({
    mutationFn: (data: NotificationPreferences) => api.notificationPreferences.put(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['notification-preferences'], updated)
    },
  })

  const save = async () => {
    try {
      await mutateAsync(prefs)
    } catch (err) {
      throw err instanceof ApiError ? err : new Error('Failed to save')
    }
  }

  const discard = () => {
    if (saved) setPrefs(saved)
  }

  const setPrefsField = (next: NotificationPreferences | ((p: NotificationPreferences) => NotificationPreferences)) => {
    setPrefs(next)
  }

  return {
    prefs,
    setPrefs: setPrefsField,
    saved: saved ?? defaultPrefs(),
    loading,
    saving,
    error: error as Error | null,
    refetch: async () => { await refetch() },
    save,
    discard,
  }
}
