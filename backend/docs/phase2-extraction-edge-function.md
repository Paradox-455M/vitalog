# Phase 2: Extraction Edge Function

This repo scaffolds `backend/supabase/functions/extraction`, which:
1. Accepts `POST { document_id: "<uuid>" }` with a valid Supabase access token (`Authorization: Bearer <jwt>`).
2. Fetches the `documents` row and downloads the original file from Storage.
3. Calls Claude Vision (Claude Messages API) to extract structured health values (JSON).
4. Normalizes values using `CANONICAL_MAP` and inserts into `health_values`.
5. Calls Claude again to generate a plain-language explanation, then caches it into `documents.explanation_text`.
6. Sets `documents.extraction_status` to `processing | complete | failed`.

## Required secrets
- `ANTHROPIC_API_KEY` (read by the edge function via `Deno.env.get('ANTHROPIC_API_KEY')`)

Set it (for the linked Supabase project):
```bash
supabase secrets set ANTHROPIC_API_KEY=<your_key>
```

## Local run (needs Docker Desktop)
1. Start Docker Desktop.
2. From `vitalog/backend/`:
```bash
supabase start
supabase db push --local
```
3. If you want to invoke the function locally, deploy/serve it after start:
```bash
supabase functions serve extraction
```
4. Call it:
```bash
curl -X POST http://localhost:54321/functions/v1/extraction \
  -H "Authorization: Bearer <your_supabase_access_token>" \
  -H "content-type: application/json" \
  -d '{"document_id":"<uuid>"}'
```

## Notes / expectations
- This scaffold uses Claude Messages API PDF support and passes PDFs as base64 `document` blocks.
- The function does not log extracted health data. On failure it sets `documents.extraction_status = 'failed'`.
- For this to work end-to-end, Phase 4’s upload flow must create `documents.storage_path` following:
  - Storage bucket: `documents`
  - Object name: `documents/{owner_id}/{uuid}.{ext}`
