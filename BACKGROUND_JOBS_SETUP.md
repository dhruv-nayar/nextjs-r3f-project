# Background Job Processing Setup

## Overview

This application uses a background job queue system to handle asynchronous image processing tasks like background removal (rembg) and GLB generation. The system is designed to:

1. **Save uploaded images immediately** to Vercel Blob storage
2. **Persist to localStorage immediately** so users see their uploads right away
3. **Process images in the background** without blocking the UI
4. **Continue processing even if the user closes the page** - results are saved when they return

## Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Vercel Blob Storage
# Get your token from: https://vercel.com/dashboard/stores
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx

# Trellis API (Modal)
# Your Modal API endpoint and key
TRELLIS_API_URL=https://nayardhruv0--trellis-api-fastapi-app.modal.run
TRELLIS_API_KEY=your_trellis_api_key_here
```

### How to Get Your Tokens

#### 1. Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Storage → Blob
3. Create a new Blob store if you haven't already
4. Copy the `BLOB_READ_WRITE_TOKEN` from the store settings

#### 2. Trellis API Key

1. Log in to your Modal account
2. Navigate to your Trellis API app
3. Copy the API endpoint URL
4. Generate an API key from the Modal dashboard

## Architecture

### Components

1. **Background Job Queue** (`lib/background-jobs.ts`)
   - Stores job state in localStorage
   - Tracks job status: `pending`, `processing`, `completed`, `failed`
   - Automatically retries failed jobs (up to 3 times)

2. **Background Job Processor** (`lib/background-job-processor.ts`)
   - Runs continuously in the browser
   - Processes up to 2 jobs concurrently
   - Polls the queue every 2 seconds
   - Survives page refreshes by reading from localStorage

3. **React Hooks** (`lib/use-background-jobs.ts`)
   - `useBackgroundJobs()` - Get all jobs with auto-refresh
   - `useItemJobs(itemId)` - Get jobs for a specific item
   - `useJobStats()` - Get queue statistics
   - `useCreateBackgroundJob()` - Create new background jobs
   - `useItemProcessingStatus(itemId)` - Get processing status for an item

4. **Global Manager** (`components/GlobalBackgroundJobManager.tsx`)
   - Automatically starts the processor when the app loads
   - Runs at the root level (in layout.tsx)
   - Logs job statistics to console

### Job Flow

```
User uploads image
       ↓
1. Image uploaded to Vercel Blob IMMEDIATELY
       ↓
2. Item saved to localStorage with original image URL
       ↓
3. Background job created for rembg processing
       ↓
4. User sees original image right away
       ↓
5. Background processor picks up the job
       ↓
6. Rembg API called to remove background
       ↓
7. Processed image uploaded to Vercel Blob
       ↓
8. Job marked as complete with processed image URL
       ↓
9. UI automatically updates with processed image
       ↓
10. Item in localStorage updated with processed image URL
```

## How It Works

### Immediate Persistence

When a user uploads an image:

1. The original image is uploaded to Vercel Blob **immediately**
2. The item is saved to localStorage with the original image URL **right away**
3. A background job is created to process the image
4. The user sees their uploaded image instantly

### Background Processing

The background job processor:

1. Runs continuously in the browser tab
2. Checks the job queue every 2 seconds
3. Processes jobs asynchronously
4. Saves results back to the item in localStorage
5. Updates the UI in real-time

### Page Refresh Handling

If the user closes the page or refreshes:

1. Jobs remain in localStorage
2. When the user returns, the processor restarts automatically
3. Pending jobs are picked up and processed
4. Completed jobs are displayed immediately

### Error Handling

- Failed jobs are automatically retried up to 3 times
- After 3 failures, the job is marked as permanently failed
- Users see error messages in the UI
- Old completed/failed jobs are cleaned up after 24 hours

## Usage in Components

### Creating a Background Job

```typescript
import { useCreateBackgroundJob } from '@/lib/use-background-jobs'

const createJob = useCreateBackgroundJob()

// Create a rembg job
const job = createJob('rembg', itemId, {
  originalImageUrl: 'https://...',
  originalImageBase64: 'data:image/png;base64,...'
})
```

### Watching Job Progress

```typescript
import { useItemProcessingStatus } from '@/lib/use-background-jobs'

const status = useItemProcessingStatus(itemId)

// Check status
console.log(status.isProcessing) // true/false
console.log(status.processedImageUrl) // URL when complete
console.log(status.rembgJob?.status) // Job status
```

### Displaying Job Status

```typescript
const { jobs } = useItemJobs(itemId)

jobs.forEach(job => {
  console.log(`${job.type}: ${job.status}`)
  if (job.output?.processedImageUrl) {
    console.log('Result:', job.output.processedImageUrl)
  }
})
```

## Testing the System

### 1. Test Immediate Upload

1. Upload an image
2. Verify the original image appears immediately
3. Check localStorage to confirm the item was saved

### 2. Test Background Processing

1. Upload an image
2. Watch the console for job status logs
3. Wait for "Processing complete" message
4. Verify processed image appears in the UI

### 3. Test Page Refresh

1. Upload an image (wait for processing to start)
2. Refresh the page before processing completes
3. Verify the original image is still visible
4. Verify processing continues and completes
5. Verify processed image appears when complete

### 4. Test Error Handling

1. Set an invalid `TRELLIS_API_KEY`
2. Upload an image
3. Verify error message appears in UI
4. Check console for retry attempts
5. Verify job marked as failed after 3 retries

## Troubleshooting

### Images not uploading

**Error:** `Vercel Blob: No token found`
**Solution:** Add `BLOB_READ_WRITE_TOKEN` to `.env.local`

### Background removal failing

**Error:** `Modal API error: 401 {"detail":"Not authenticated"}`
**Solution:** Add valid `TRELLIS_API_KEY` to `.env.local`

### Jobs not processing

**Check:**
1. Open browser console - you should see job statistics logged
2. Verify `GlobalBackgroundJobManager` is in your layout.tsx
3. Check localStorage for jobs (key: `homeEditor_backgroundJobs_v1`)

### Jobs stuck in "processing"

**Solution:**
1. Clear localStorage: `localStorage.clear()`
2. Refresh the page
3. Jobs will restart from pending state

## Performance Considerations

- Maximum 2 jobs processed concurrently (configurable)
- Job queue polling interval: 2 seconds (configurable)
- Old jobs cleaned up after 24 hours
- localStorage has ~5-10MB limit per domain

## Future Improvements

- [ ] Add server-side job queue (Redis/BullMQ)
- [ ] Add WebSocket support for real-time updates
- [ ] Add progress percentage for long-running jobs
- [ ] Add job cancellation support
- [ ] Add batch job processing
- [ ] Add job priority levels
