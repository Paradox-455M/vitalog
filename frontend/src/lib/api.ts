import { supabase } from './supabaseClient'

/** Base URL for the Go API. Set `VITE_API_URL` to call a remote API; otherwise uses same-origin (Vite dev proxy in development). */
function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  if (raw != null && raw !== '') {
    return raw.replace(/\/$/, '')
  }
  return ''
}

const API_URL = getApiBaseUrl()

export class ApiError extends Error {
  status: number
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const headers = new Headers(options.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      body?.error || `Request failed with status ${response.status}`,
      response.status,
      body
    )
  }

  return response.json()
}

export const api = {
  documents: {
    list: (params?: {
      family_member_id?: string
      document_type?: string
      status?: string
      search?: string
      lab?: string
      from_date?: string
      to_date?: string
      limit?: number
      offset?: number
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.family_member_id) searchParams.set('family_member_id', params.family_member_id)
      if (params?.document_type) searchParams.set('document_type', params.document_type)
      if (params?.status) searchParams.set('status', params.status)
      if (params?.search) searchParams.set('search', params.search)
      if (params?.lab) searchParams.set('lab', params.lab)
      if (params?.from_date) searchParams.set('from_date', params.from_date)
      if (params?.to_date) searchParams.set('to_date', params.to_date)
      if (params?.limit != null) searchParams.set('limit', String(params.limit))
      if (params?.offset != null) searchParams.set('offset', String(params.offset))
      const query = searchParams.toString()
      return apiClient<PaginatedDocuments>(`/api/documents${query ? `?${query}` : ''}`)
    },

    labs: () => apiClient<string[]>('/api/documents/labs'),

    get: (id: string) =>
      apiClient<DocumentWithHealthValues>(`/api/documents/${id}`),

    downloadFile: async (id: string): Promise<string> => {
      const token = await getAuthToken()
      const headers = new Headers()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(`${API_URL}/api/documents/${id}/file`, { headers })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new ApiError(
          body?.error || `Request failed with status ${response.status}`,
          response.status,
          body
        )
      }
      const blob = await response.blob()
      return URL.createObjectURL(blob)
    },

    upload: async (file: File, familyMemberId?: string) => {
      const formData = new FormData()
      formData.append('file', file)
      if (familyMemberId) {
        formData.append('family_member_id', familyMemberId)
      }
      return apiClient<Document>('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })
    },

    delete: (id: string) =>
      apiClient<{ deleted: boolean }>(`/api/documents/${id}`, {
        method: 'DELETE',
      }),

    extract: (id: string) =>
      apiClient<{ status: string; document_id: string }>(
        `/api/documents/${id}/extract`,
        { method: 'POST' }
      ),
  },

  healthValues: {
    list: (params?: {
      family_member_id?: string
      canonical_name?: string
      from_date?: string
      to_date?: string
    }) => {
      const searchParams = new URLSearchParams()
      if (params?.family_member_id) searchParams.set('family_member_id', params.family_member_id)
      if (params?.canonical_name) searchParams.set('canonical_name', params.canonical_name)
      if (params?.from_date) searchParams.set('from_date', params.from_date)
      if (params?.to_date) searchParams.set('to_date', params.to_date)
      const query = searchParams.toString()
      return apiClient<HealthValue[]>(`/api/health-values${query ? `?${query}` : ''}`)
    },

    timeline: (canonicalName: string, familyMemberId?: string) => {
      const searchParams = new URLSearchParams()
      if (familyMemberId) searchParams.set('family_member_id', familyMemberId)
      const query = searchParams.toString()
      return apiClient<TimelineData>(
        `/api/timeline/${canonicalName}${query ? `?${query}` : ''}`
      )
    },
  },

  family: {
    list: () => apiClient<FamilyMember[]>('/api/family'),

    create: (data: CreateFamilyMemberRequest) =>
      apiClient<FamilyMember>('/api/family', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateFamilyMemberRequest) =>
      apiClient<FamilyMember>(`/api/family/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      apiClient<{ deleted: boolean }>(`/api/family/${id}`, {
        method: 'DELETE',
      }),
  },

  profile: {
    get: () => apiClient<ProfileWithDocCount>('/api/profile'),

    update: (data: UpdateProfileRequest) =>
      apiClient<Profile>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  notificationPreferences: {
    get: () => apiClient<NotificationPreferences>('/api/notification-preferences'),
    put: (data: NotificationPreferences) =>
      apiClient<NotificationPreferences>('/api/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  notifications: {
    list: (params?: { limit?: number; before?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', String(params.limit))
      if (params?.before) searchParams.set('before', params.before)
      const q = searchParams.toString()
      return apiClient<NotificationsListResponse>(
        `/api/notifications${q ? `?${q}` : ''}`,
      )
    },
    markRead: (id: string) =>
      apiClient<{ ok: boolean }>(`/api/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      }),
    markAllRead: () =>
      apiClient<{ ok: boolean }>('/api/notifications/mark-all-read', {
        method: 'POST',
      }),
  },

  privacy: {
    recordAccessEvent: (userAgent?: string | null) =>
      apiClient<{ ok: boolean }>('/api/privacy/access-events', {
        method: 'POST',
        body: JSON.stringify(
          userAgent ? { user_agent: userAgent } : {},
        ),
      }),

    listAccessEvents: (limit?: number) => {
      const q = limit != null ? `?limit=${limit}` : ''
      return apiClient<AccessEvent[]>(`/api/privacy/access-events${q}`)
    },

    /** Streams JSON export as a file download (synchronous v1 export). */
    downloadDataExport: async (): Promise<void> => {
      const token = await getAuthToken()
      const headers = new Headers()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(`${API_URL}/api/privacy/data-export`, { headers })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const msg =
          body &&
          typeof body === 'object' &&
          'error' in body &&
          typeof (body as { error: unknown }).error === 'string'
            ? (body as { error: string }).error
            : `Request failed with status ${response.status}`
        throw new ApiError(msg, response.status, body)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'vitalog-export.json'
      a.click()
      URL.revokeObjectURL(url)
    },

    deleteAccount: (confirm: string) =>
      apiClient<{ deleted: boolean }>('/api/privacy/delete-account', {
        method: 'POST',
        body: JSON.stringify({ confirm }),
      }),
  },

  subscription: {
    listPayments: (limit?: number) => {
      const q = limit != null ? `?limit=${limit}` : ''
      return apiClient<SubscriptionPayment[]>(`/api/subscription/payments${q}`)
    },
    createOrder: () =>
      apiClient<CreateOrderResponse>('/api/subscription/create-order', { method: 'POST' }),
  },

  dashboard: {
    stats: (params?: { family_member_id?: string }) => {
      const searchParams = new URLSearchParams()
      if (params?.family_member_id) searchParams.set('family_member_id', params.family_member_id)
      const q = searchParams.toString()
      return apiClient<DashboardStats>(`/api/dashboard/stats${q ? `?${q}` : ''}`)
    },
  },
}

export interface AccessEvent {
  id: string
  user_id: string
  created_at: string
  ip_address: string | null
  user_agent: string | null
  event_type: string
}

export interface CreateOrderResponse {
  order_id: string
  amount: number
  currency: string
  key_id: string
  mock: boolean
}

export interface SubscriptionPayment {
  id: string
  user_id: string
  razorpay_payment_id: string
  amount_paise: number
  currency: string
  status: string
  created_at: string
}

export interface Document {
  id: string
  owner_id: string
  family_member_id: string | null
  storage_path: string
  file_name: string
  file_type: string | null
  document_type: string | null
  report_date: string | null
  lab_name: string | null
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed'
  explanation_text: string | null
  created_at: string
  deleted_at: string | null
}

export interface FlaggedValueSummary {
  canonical_name: string
  display_name: string
  value: number
  unit: string | null
  is_flagged: boolean
}

export interface DocumentListItem extends Document {
  flagged_count: number
  flagged_values: FlaggedValueSummary[]
}

export interface PaginatedDocuments {
  items: DocumentListItem[]
  total: number
  limit: number
  offset: number
}

export interface DashboardStats {
  report_count: number
  values_tracked: number
  flagged_count: number
  last_upload_at: string | null
}

export interface HealthValue {
  id: string
  document_id: string
  family_member_id: string | null
  canonical_name: string
  display_name: string
  value: number
  unit: string | null
  reference_low: number | null
  reference_high: number | null
  is_flagged: boolean
  report_date: string
  created_at: string
}

export interface DocumentWithHealthValues extends Document {
  health_values: HealthValue[]
}

export interface TimelinePoint {
  report_date: string
  value: number
  document_id: string
}

export interface TimelineData {
  canonical_name: string
  display_name: string
  unit: string | null
  reference_low: number | null
  reference_high: number | null
  points: TimelinePoint[]
}

export interface FamilyMember {
  id: string
  owner_id: string
  name: string
  relationship: string | null
  date_of_birth: string | null
  created_at: string
}

export interface CreateFamilyMemberRequest {
  name: string
  relationship?: string
  date_of_birth?: string
}

export interface UpdateFamilyMemberRequest {
  name?: string
  relationship?: string
  date_of_birth?: string
}

export interface Profile {
  id: string
  created_at: string
  email: string
  full_name: string
  avatar_url: string | null
  plan: 'free' | 'pro'
}

export interface ProfileWithDocCount extends Profile {
  document_count: number
}

export interface UpdateProfileRequest {
  full_name?: string
  avatar_url?: string
}

export interface NotificationPreferences {
  new_report: boolean
  trend_detected: boolean
  family_updates: boolean
  health_tips: boolean
  email: boolean
  push: boolean
  whatsapp: boolean
  tone: 'direct' | 'soft'
}

export interface NotificationListItem {
  id: string
  title: string
  body: string
  kind: string
  read: boolean
  created_at: string
  icon: string
  document_id?: string
}

export interface NotificationsListResponse {
  items: NotificationListItem[]
  next_cursor: string | null
  unread_count: number
}
