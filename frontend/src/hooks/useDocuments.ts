import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { Document, DocumentListItem } from '../lib/api'

interface UseDocumentsOptions {
  familyMemberId?: string
  documentType?: string
  status?: string
  search?: string
  lab?: string
  fromDate?: string
  toDate?: string
  limit?: number
  offset?: number
}

interface UseDocumentsResult {
  documents: DocumentListItem[]
  total: number
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useDocuments(options?: UseDocumentsOptions): UseDocumentsResult {
  const queryKey = [
    'documents',
    options?.familyMemberId,
    options?.documentType,
    options?.status,
    options?.search,
    options?.lab,
    options?.fromDate,
    options?.toDate,
    options?.limit,
    options?.offset,
  ]

  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => api.documents.list({
      family_member_id: options?.familyMemberId,
      document_type: options?.documentType,
      status: options?.status,
      search: options?.search,
      lab: options?.lab,
      from_date: options?.fromDate,
      to_date: options?.toDate,
      limit: options?.limit,
      offset: options?.offset,
    }),
  })

  return {
    documents: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
  }
}

interface UseDocumentResult {
  document: Document | null
  healthValues: import('../lib/api').HealthValue[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useDocument(id: string | undefined): UseDocumentResult {
  const { data, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['document', id],
    queryFn: () => api.documents.get(id!),
    enabled: !!id,
  })

  return {
    document: data ?? null,
    healthValues: data?.health_values ?? [],
    loading,
    error: error as Error | null,
    refetch: async () => { await refetch() },
  }
}

interface UseUploadResult {
  upload: (file: File, familyMemberId?: string) => Promise<Document>
  uploading: boolean
  error: Error | null
}

export function useUpload(): UseUploadResult {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending: uploading, error } = useMutation({
    mutationFn: ({ file, familyMemberId }: { file: File; familyMemberId?: string }) =>
      api.documents.upload(file, familyMemberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  const upload = async (file: File, familyMemberId?: string): Promise<Document> => {
    try {
      return await mutateAsync({ file, familyMemberId })
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new Error('Upload failed')
      throw apiError
    }
  }

  return { upload, uploading, error: error as Error | null }
}

interface UseExtractionResult {
  extract: (documentId: string) => Promise<void>
  extracting: boolean
  error: Error | null
}

export function useExtraction(): UseExtractionResult {
  const queryClient = useQueryClient()

  const { mutateAsync, isPending: extracting, error } = useMutation({
    mutationFn: (documentId: string) => api.documents.extract(documentId),
    onSuccess: (_data, documentId) => {
      void queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const extract = async (documentId: string): Promise<void> => {
    try {
      await mutateAsync(documentId)
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new Error('Extraction failed')
      throw apiError
    }
  }

  return { extract, extracting, error: error as Error | null }
}
