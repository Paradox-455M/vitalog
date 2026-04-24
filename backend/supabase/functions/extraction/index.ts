import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { encode as base64Encode } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import { CANONICAL_MAP } from '../_shared/canonicalMap.ts'
import { EXTRACTION_PROMPT, EXPLANATION_PROMPT } from '../_shared/prompts.ts'

type ExtractedTest = {
  raw_name: string
  canonical_name: string
  display_name: string
  value: number
  unit: string
  reference_low: number | null
  reference_high: number | null
  is_flagged: boolean
}

type ExtractedPayload = {
  document_type:
    | 'blood_test'
    | 'prescription'
    | 'discharge_summary'
    | 'scan'
    | 'other'
  report_date: string | null
  lab_name: string | null
  patient_name: string | null
  tests: ExtractedTest[]
}

const VALID_DOC_TYPES = new Set([
  'blood_test', 'prescription', 'discharge_summary', 'scan', 'other',
])

// sanitizeString prevents prompt-injection by limiting length and stripping control chars (C3).
function sanitizeString(s: unknown, maxLen = 200): string {
  if (typeof s !== 'string') return ''
  return s.replace(/[\x00-\x1F\x7F]/g, ' ').trim().slice(0, maxLen)
}

function safeJsonParse(text: string): unknown {
  // Models can wrap JSON in fences; strip common wrappers.
  const trimmed = text.trim()
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')

  // If the response has extra leading/trailing text, try to isolate the object.
  const startIdx = withoutFences.indexOf('{')
  const endIdx = withoutFences.lastIndexOf('}')
  if (startIdx >= 0 && endIdx >= 0 && endIdx > startIdx) {
    const candidate = withoutFences.slice(startIdx, endIdx + 1)
    return JSON.parse(candidate)
  }
  return JSON.parse(withoutFences)
}

function toSnakeCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeCanonicalName(raw: string): string {
  const key = raw.trim().toLowerCase()
  return CANONICAL_MAP[key] ?? toSnakeCase(raw)
}

function computeIsFlagged(value: number, low: number | null, high: number | null) {
  if (low !== null && value < low) return true
  if (high !== null && value > high) return true
  return false
}

function canonicalToDisplayName(canonical: string): string {
  return canonical
    .split('_')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function base64FromUint8Array(bytes: Uint8Array): string {
  return base64Encode(bytes)
}

function contentTypeFromFileType(fileType: string | null | undefined): {
  mediaType: string
  blockType: 'image' | 'document'
} {
  const ft = (fileType ?? '').toLowerCase()
  if (ft.includes('pdf') || ft === 'application/pdf' || ft.endsWith('.pdf')) {
    return { mediaType: 'application/pdf', blockType: 'document' }
  }
  if (ft.includes('png') || ft === 'image/png' || ft.endsWith('.png')) {
    return { mediaType: 'image/png', blockType: 'image' }
  }
  if (ft.includes('jpeg') || ft.includes('jpg') || ft.endsWith('.jpg') || ft.endsWith('.jpeg') || ft === 'image/jpeg') {
    return { mediaType: 'image/jpeg', blockType: 'image' }
  }
  if (ft.includes('webp') || ft === 'image/webp' || ft.endsWith('.webp')) {
    return { mediaType: 'image/webp', blockType: 'image' }
  }

  // Default to PDF to match expected lab report formats.
  return { mediaType: 'application/pdf', blockType: 'document' }
}

function extractTextFromAnthropicResponse(resp: any): string {
  // Messages API returns `content` blocks; grab all text blocks.
  const blocks = resp?.content ?? []
  if (!Array.isArray(blocks)) return ''
  const texts = blocks
    .filter((b: any) => b?.type === 'text' && typeof b?.text === 'string')
    .map((b: any) => b.text)
  return texts.join('\n').trim()
}

async function callAnthropicExtract({
  anthropicApiKey,
  model,
  base64Data,
  mediaType,
  blockType,
}: {
  anthropicApiKey: string
  model: string
  base64Data: string
  mediaType: string
  blockType: 'image' | 'document'
}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: blockType,
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Anthropic extraction failed: ${JSON.stringify(json)}`)
  }

  return json
}

async function callAnthropicExplain({
  anthropicApiKey,
  model,
  extractedJson,
}: {
  anthropicApiKey: string
  model: string
  extractedJson: string
}) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: EXPLANATION_PROMPT(extractedJson) }],
        },
      ],
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Anthropic explanation failed: ${JSON.stringify(json)}`)
  }
  return json
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { document_id } = await req.json().catch(() => ({ document_id: null }))
  if (!document_id || typeof document_id !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing document_id' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const userId = userData.user.id

  // Fetch the document (RLS should already ensure owner-scoping).
  const { data: docRow, error: docErr } = await supabase
    .from('documents')
    .select('id, owner_id, storage_path, file_type, document_type, report_date, family_member_id')
    .eq('id', document_id)
    .single()

  if (docErr || !docRow) {
    return new Response(JSON.stringify({ error: 'Document not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (docRow.owner_id !== userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Mark processing. RLS update policy allows owner updates.
  await supabase
    .from('documents')
    .update({ extraction_status: 'processing' })
    .eq('id', docRow.id)

  try {
    const objectPath = String(docRow.storage_path).replace(/^documents\//, '')
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('documents')
      .download(objectPath)

    if (downloadErr) {
      throw new Error(`Storage download failed: ${downloadErr.message}`)
    }

    // fileData is either a Blob or a Response-like object in Edge runtime.
    let arrayBuffer: ArrayBuffer | null = null
    if (typeof (fileData as any)?.arrayBuffer === 'function') {
      arrayBuffer = await (fileData as any).arrayBuffer()
    } else if (fileData instanceof ArrayBuffer) {
      arrayBuffer = fileData
    } else if (fileData instanceof Uint8Array) {
      arrayBuffer = fileData.buffer
    }

    if (!arrayBuffer) throw new Error('Could not read downloaded file data')

    const bytes = new Uint8Array(arrayBuffer)
    const base64Data = base64FromUint8Array(bytes)

    const { mediaType, blockType } = contentTypeFromFileType(docRow.file_type)

    const extractResp = await callAnthropicExtract({
      anthropicApiKey,
      model: 'claude-3-5-sonnet',
      base64Data,
      mediaType,
      blockType,
    })

    const extractText = extractTextFromAnthropicResponse(extractResp)
    const extractedUnknown = safeJsonParse(extractText)

    if (!extractedUnknown || typeof extractedUnknown !== 'object') {
      throw new Error('Extraction JSON parse failed')
    }

    const extracted = extractedUnknown as ExtractedPayload

    // L1: Validate required fields before trusting the LLM output.
    if (!Array.isArray(extracted.tests)) {
      throw new Error('Extraction JSON has no tests array')
    }
    if (typeof extracted !== 'object' || extracted === null) {
      throw new Error('Extraction result is not an object')
    }
    // Validate document_type is one of the allowed enum values (C3: prevent injection).
    if (extracted.document_type && !VALID_DOC_TYPES.has(extracted.document_type)) {
      extracted.document_type = 'other'
    }

    const reportDate =
      extracted.report_date ?? docRow.report_date ?? new Date().toISOString().slice(0, 10)

    const normalizedTests = extracted.tests.map((t) => {
      const rawName = typeof t.raw_name === 'string' ? t.raw_name : ''
      const canonical = normalizeCanonicalName(
        typeof t.canonical_name === 'string' && t.canonical_name ? t.canonical_name : rawName,
      )
      const display = typeof t.display_name === 'string' && t.display_name
        ? t.display_name
        : canonicalToDisplayName(canonical)

      const value = typeof t.value === 'number' ? t.value : Number((t.value as any) ?? NaN)
      const reference_low =
        typeof t.reference_low === 'number' ? t.reference_low : t.reference_low === null ? null : null
      const reference_high =
        typeof t.reference_high === 'number' ? t.reference_high : t.reference_high === null ? null : null

      const is_flagged =
        typeof t.is_flagged === 'boolean' ? t.is_flagged : computeIsFlagged(value, reference_low, reference_high)

      return {
        raw_name: rawName,
        canonical_name: canonical,
        display_name: display,
        value,
        unit: typeof t.unit === 'string' ? t.unit : '',
        reference_low,
        reference_high,
        is_flagged,
      }
    })

    // C3: Build the prompt payload from validated/sanitized fields only.
    // Never interpolate raw text from the PDF — only typed, bounded values.
    const extractedJsonForPrompt = JSON.stringify({
      document_type: VALID_DOC_TYPES.has(extracted.document_type ?? '') ? extracted.document_type : 'other',
      report_date: sanitizeString(extracted.report_date, 10),
      lab_name: sanitizeString(extracted.lab_name),
      patient_name: sanitizeString(extracted.patient_name),
      tests: normalizedTests.map((t) => ({
        canonical_name: sanitizeString(t.canonical_name, 100),
        display_name: sanitizeString(t.display_name, 100),
        value: typeof t.value === 'number' && isFinite(t.value) ? t.value : null,
        unit: sanitizeString(t.unit, 30),
        reference_low: typeof t.reference_low === 'number' ? t.reference_low : null,
        reference_high: typeof t.reference_high === 'number' ? t.reference_high : null,
        is_flagged: Boolean(t.is_flagged),
      })),
    })

    // Insert health values (one row per extracted test).
    // We insert in chunks to avoid payload issues for very large documents.
    const rows = normalizedTests.map((t) => ({
      document_id: docRow.id,
      family_member_id: docRow.family_member_id,
      canonical_name: t.canonical_name,
      display_name: t.display_name,
      value: t.value,
      unit: t.unit,
      reference_low: t.reference_low,
      reference_high: t.reference_high,
      is_flagged: t.is_flagged,
      report_date: reportDate,
    }))

    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      const { error: insertErr } = await supabase.from('health_values').insert(chunk)
      if (insertErr) throw new Error(`Insert health_values failed: ${insertErr.message}`)
    }

    const explainResp = await callAnthropicExplain({
      anthropicApiKey,
      model: 'claude-3-5-sonnet',
      extractedJson: extractedJsonForPrompt,
    })

    const explainText = extractTextFromAnthropicResponse(explainResp)

    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        extraction_status: 'complete',
        explanation_text: explainText,
      })
      .eq('id', docRow.id)

    if (updateErr) {
      throw new Error(`Update documents failed: ${updateErr.message}`)
    }

    return new Response(JSON.stringify({ ok: true, document_id: docRow.id }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    // Never log raw extracted health data.
    const message = err instanceof Error ? err.message : 'Extraction failed'
    await supabase
      .from('documents')
      .update({ extraction_status: 'failed' })
      .eq('id', docRow.id)

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})

