import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { put } from '@vercel/blob'
import { TrellisJobRow, TrellisJobUpdate } from '@/types/database'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''
const CRON_SECRET = process.env.CRON_SECRET || ''

export async function GET(request: NextRequest) {
  // Verify cron secret (for Vercel Cron authentication)
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get pending/processing jobs that haven't received webhook
    // and haven't been polled in the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()

    const { data: jobs, error } = await supabaseAdmin
      .from('trellis_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .eq('webhook_received', false)
      .or(`last_polled_at.is.null,last_polled_at.lt.${thirtySecondsAgo}`)
      .limit(10)

    if (error) {
      console.error('[cron/poll-jobs] Query error:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ polled: 0, message: 'No pending jobs' })
    }

    console.log(`[cron/poll-jobs] Polling ${jobs.length} jobs`)

    let successCount = 0
    for (const job of jobs) {
      const success = await pollJob(job as TrellisJobRow)
      if (success) successCount++
    }

    return NextResponse.json({
      polled: jobs.length,
      updated: successCount
    })

  } catch (error) {
    console.error('[cron/poll-jobs] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function pollJob(job: TrellisJobRow): Promise<boolean> {
  try {
    // Poll Trellis API for job status
    const response = await fetch(
      `${TRELLIS_API_URL}/api/v1/jobs/${job.job_id}`,
      {
        headers: { 'Authorization': `Bearer ${TRELLIS_API_KEY}` }
      }
    )

    if (!response.ok) {
      console.error(`[cron/poll-jobs] Poll failed for ${job.job_id}: ${response.status}`)
      // Update last_polled_at to avoid hammering
      await supabaseAdmin
        .from('trellis_jobs')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('job_id', job.job_id)
      return false
    }

    const data = await response.json()

    // Build update object
    const updates: TrellisJobUpdate = {
      status: data.status,
      progress: data.progress || 0,
      message: data.message,
      last_polled_at: new Date().toISOString(),
    }

    // Handle completion
    // Note: API returns download_url (singular), not download_urls
    const downloadUrls = data.download_urls || (data.download_url ? [data.download_url] : [])
    if (data.status === 'completed' && downloadUrls.length > 0) {
      updates.download_urls = downloadUrls
      updates.completed_at = new Date().toISOString()

      // Download and persist files
      const resultUrls = await downloadAndPersistFiles(
        job.job_id,
        job.item_id,
        job.type,
        downloadUrls
      )
      updates.result_urls = resultUrls

      console.log(`[cron/poll-jobs] Job ${job.job_id} completed, files:`, resultUrls)
    }

    // Handle failure
    if (data.status === 'failed') {
      updates.error = data.error || 'Job failed'
    }

    // Update database
    const { error: updateError } = await supabaseAdmin
      .from('trellis_jobs')
      .update(updates)
      .eq('job_id', job.job_id)

    if (updateError) {
      console.error(`[cron/poll-jobs] Update failed for ${job.job_id}:`, updateError)
      return false
    }

    console.log(`[cron/poll-jobs] Updated ${job.job_id}: ${data.status}`)
    return true

  } catch (error) {
    console.error(`[cron/poll-jobs] Error polling ${job.job_id}:`, error)
    return false
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
      const filename = url.split('/').pop() || 'file'

      // Download from Trellis API
      const downloadUrl = `${TRELLIS_API_URL}/api/v1/jobs/${jobId}/result`
      const response = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${TRELLIS_API_KEY}` }
      })

      if (!response.ok) {
        console.error(`[cron/poll-jobs] Download failed for ${filename}:`, response.status)
        continue
      }

      const blob = await response.blob()
      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      // Determine storage path
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

    } catch (err) {
      console.error(`[cron/poll-jobs] File download/upload failed:`, err)
    }
  }

  return resultUrls
}
