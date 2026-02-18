import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { put } from '@vercel/blob'
import { TrellisWebhookPayload, TrellisJobUpdate } from '@/types/database'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const payload: TrellisWebhookPayload = await request.json()
    const { job_id, status, progress, message, download_urls: rawDownloadUrls, download_url, error } = payload
    // Handle both singular and plural download URL formats
    const download_urls = rawDownloadUrls || (download_url ? [download_url] : undefined)

    console.log('[webhook/trellis] Received:', { job_id, status, progress })

    // Find job in database
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('trellis_jobs')
      .select('*')
      .eq('job_id', job_id)
      .single()

    if (fetchError || !job) {
      console.error('[webhook/trellis] Job not found:', job_id)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Build update object
    const updates: TrellisJobUpdate = {
      status,
      progress: progress || 0,
      message,
      webhook_received: true,
      webhook_received_at: new Date().toISOString(),
    }

    // Handle completion - download and persist files
    if (status === 'completed' && download_urls && download_urls.length > 0) {
      updates.download_urls = download_urls
      updates.completed_at = new Date().toISOString()

      // Download and persist files to Vercel Blob
      const resultUrls = await downloadAndPersistFiles(
        job_id,
        job.item_id,
        job.type,
        download_urls
      )

      updates.result_urls = resultUrls

      console.log('[webhook/trellis] Files persisted:', resultUrls)
    }

    // Handle failure
    if (status === 'failed') {
      updates.error = error || 'Job failed'
    }

    // Update database
    const { error: updateError } = await supabaseAdmin
      .from('trellis_jobs')
      .update(updates)
      .eq('job_id', job_id)

    if (updateError) {
      console.error('[webhook/trellis] Update failed:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.log('[webhook/trellis] Job updated:', job_id, status)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[webhook/trellis] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function downloadAndPersistFiles(
  jobId: string,
  itemId: string,
  type: string,
  downloadUrls: string[]
): Promise<string[]> {
  const resultUrls: string[] = []

  for (const url of downloadUrls) {
    try {
      // Extract filename from URL
      const filename = url.split('/').pop() || 'file'

      // Download from Trellis API
      const downloadUrl = `${TRELLIS_API_URL}/api/v1/jobs/${jobId}/result`
      const response = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${TRELLIS_API_KEY}` }
      })

      if (!response.ok) {
        console.error(`[webhook/trellis] Download failed for ${filename}:`, response.status)
        continue
      }

      const blob = await response.blob()
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      // Determine storage path based on job type
      const timestamp = Date.now()
      const storagePath = type === 'trellis'
        ? `items/${itemId}/${itemId}-${timestamp}.glb`
        : `items/${itemId}/images/processed-${timestamp}-${filename}`

      // Upload to Vercel Blob
      const uploaded = await put(storagePath, blob, {
        access: 'public',
        contentType,
        allowOverwrite: true,
      })

      resultUrls.push(uploaded.url)
      console.log(`[webhook/trellis] Uploaded: ${uploaded.url}`)

    } catch (err) {
      console.error(`[webhook/trellis] File download/upload failed:`, err)
    }
  }

  return resultUrls
}
