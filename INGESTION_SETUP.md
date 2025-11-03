# ContractOS - PDF Ingestion Pipeline Setup

## Overview
Automated PDF upload, queue, and AI ingestion system for mining contract documents.

## Architecture Flow
```
User uploads PDF → Storage (contracts/) → ingest_jobs queue → ingest-worker Edge Function 
→ Lovable AI Gateway (Gemini 2.5) → Structured JSON → Supabase upserts
```

---

## Required Environment Variables

### Supabase Edge Functions
Set these in your Supabase project settings under Edge Functions:

```bash
SUPABASE_URL=https://wnkifmuhkhdjbswraini.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
LOVABLE_API_KEY=<your-lovable-api-key>
```

**Note**: `LOVABLE_API_KEY` is automatically provided by Lovable Cloud integration. Do not share or expose this key.

---

## Database Schema

### Tables
- **ingest_jobs**: Queue of PDFs to process
  - `id`, `project_prefix`, `storage_path`, `file_hash`, `etag`
  - `status` (queued → working → done/failed)
  - `attempts`, `last_error`, timestamps

- **ingest_logs**: Processing step logs
  - `job_id`, `step`, `message`, `meta`, timestamps

### Function
- **get_next_ingest_job()**: Returns next queued job with row-level locking

---

## Storage Bucket

**Bucket**: `contracts` (private)

**Folder Structure**:
```
contracts/
  dominga/
    contract/      # Main contracts
    edp/          # Estados de Pago
    quality/      # Quality plans
    sso/          # Safety plans
    tech/         # Technical studies
    sdi/          # Information requests
    addendum/     # Amendments
```

**RLS Policies**: Authenticated users can read/write to `contracts` bucket.

---

## Edge Functions

### 1. ingest-enqueue
**Purpose**: Enqueue uploaded files for processing

**Endpoint**: `POST /functions/v1/ingest-enqueue`

**Payload**:
```json
{
  "project_prefix": "dominga",
  "storage_path": "dominga/edp/EDP N°1.pdf",
  "file_hash": "abc123...",
  "etag": "xyz789...",
  "contract_id": "uuid",
  "document_type": "edp"
}
```

**Response**:
```json
{
  "message": "Job enqueued and processing started",
  "job_id": "uuid",
  "storage_path": "...",
  "status": "processing"
}
```

### 2. ingest-worker
**Purpose**: Process queued jobs with AI extraction

**Flow**:
1. Get next job from queue (`get_next_ingest_job()`)
2. Download PDF from storage
3. Parse PDF text (Lovable Document Parser API)
4. Extract structured data (Lovable AI Gateway - Gemini 2.5 Flash)
5. Upsert to database tables
6. Register in `documents` table
7. Mark job as `done`

**On Error**: Marks job as `failed` with error message in `last_error`

---

## AI Processing

### Document Types Supported
- **contract**: Main contract with budget, tasks, parties
- **edp**: Payment states with amounts and task execution
- **sdi**: Information requests with due dates
- **quality/sso/tech**: Supporting plans and studies
- **addendum**: Contract amendments

### AI Model
- **Primary**: `google/gemini-2.5-flash` (balanced performance/cost)
- **Alternative**: `google/gemini-2.5-pro` (for complex documents)

### Extraction Schema
```json
{
  "document_type": "edp",
  "upserts": [
    {
      "table": "payment_states",
      "values": {
        "contract_code": "AIPD-CSI001-1000-MN-0001",
        "edp_number": 1,
        "amount_uf": 209.81,
        "period_start": "2025-07-01",
        "status": "approved"
      }
    }
  ],
  "analytics": { "spent_uf": 209.81, "progress_pct": 5 },
  "alerts": [],
  "log": []
}
```

---

## Frontend Integration

### DocumentUploader Component
Located at: `src/components/DocumentUploader.tsx`

**Features**:
- Multi-file PDF upload
- Document type selection
- Contract association
- SHA-1 file hashing
- Automatic enqueue after upload
- Real-time progress tracking
- Upload log display

**Usage**:
```tsx
<DocumentUploader 
  projectPrefix="dominga"
  defaultType="edp"
  preselectedContractId={contractId}
/>
```

---

## Monitoring & Debugging

### Check Job Status
```sql
SELECT * FROM ingest_jobs 
ORDER BY created_at DESC 
LIMIT 10;
```

### View Processing Logs
```sql
SELECT * FROM ingest_logs 
WHERE job_id = 'your-job-uuid'
ORDER BY created_at;
```

### Common Issues

**Jobs stay in "queued"**:
- Check if `ingest-worker` is deployed
- Verify `get_next_ingest_job()` function exists
- Check Edge Function logs for errors

**Jobs fail with "failed" status**:
- Check `last_error` column in `ingest_jobs`
- Review `ingest_logs` for detailed error messages
- Verify environment variables are set

**AI extraction returns empty/incorrect data**:
- Check if PDF is text-based (not scanned image)
- Review system prompt in `buildSystemPrompt()`
- Verify document type matches content
- Check Lovable AI Gateway quota/credits

**Upload fails**:
- Verify storage bucket policies allow authenticated writes
- Check file size (max 100MB)
- Ensure file is valid PDF

---

## Success Criteria

✅ Uploading PDF creates job in `ingest_jobs` (status: "queued")
✅ Worker picks up job and marks as "working"
✅ AI extracts structured data from PDF
✅ Data is upserted to correct tables
✅ Job marked as "done" with no errors
✅ Document registered in `documents` table

---

## Security Notes

- Storage bucket is **private** - requires authentication
- Edge functions use **SERVICE_ROLE_KEY** for elevated access
- LOVABLE_API_KEY is protected and auto-provisioned
- All file uploads are logged with hash/etag for audit trail
- RLS policies enforce data access controls

---

## Future Enhancements

- [ ] Webhook trigger on storage.objects.created event
- [ ] Realtime notifications for job status updates
- [ ] Batch processing for multiple jobs
- [ ] Retry logic with exponential backoff
- [ ] Document versioning and diff tracking
- [ ] OCR support for scanned PDFs
- [ ] Multi-language extraction
