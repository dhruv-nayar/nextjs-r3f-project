import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { put } from '@vercel/blob'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

interface TrellisJobStatus {
  job_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  message?: string
  error?: string
  download_url?: string
  output_size_bytes?: number
}

export async function POST() {
  try {
    // Get all pending/processing jobs from Supabase
    const { data: jobs, error: fetchError } = await supabaseAdmin
      .from('trellis_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('[poll-jobs] Failed to fetch jobs:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ polled: 0, updated: 0 })
    }

    console.log(`[poll-jobs] Polling ${jobs.length} pending/processing jobs...`)

    let updated = 0

    for (const job of jobs) {
      try {
        // Query Trellis API for job status
        const response = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${job.job_id}`, {
          headers: { 'Authorization': `Bearer ${TRELLIS_API_KEY}` }
        })

        if (!response.ok) {
          if (response.status === 404) {
            // Job not found on Trellis - mark as failed
            console.log(`[poll-jobs] Job ${job.job_id} not found on Trellis API`)
            await supabaseAdmin
              .from('trellis_jobs')
              .update({
                status: 'failed',
                error: 'Job not found on Trellis API',
                updated_at: new Date().toISOString(),
              })
              .eq('job_id', job.job_id)
            updated++
          }
          continue
        }

        const trellisJob: TrellisJobStatus = await response.json()

        // Check if status changed
        if (trellisJob.status !== job.status || trellisJob.progress !== job.progress) {
          console.log(`[poll-jobs] Job ${job.job_id}: ${job.status} -> ${trellisJob.status}`)

          const updates: Record<string, unknown> = {
            status: trellisJob.status,
            progress: trellisJob.progress || 0,
            message: trellisJob.message,
            updated_at: new Date().toISOString(),
          }

          // Handle completion - download and persist the GLB
          if (trellisJob.status === 'completed' && trellisJob.download_url) {
            updates.completed_at = new Date().toISOString()

            // Download the result from Trellis
            const downloadResponse = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${job.job_id}/result`, {
              headers: { 'Authorization': `Bearer ${TRELLIS_API_KEY}` }
            })

            if (downloadResponse.ok) {
              const blob = await downloadResponse.blob()
              const contentType = downloadResponse.headers.get('content-type') || 'model/gltf-binary'

              // Upload to Vercel Blob
              const timestamp = Date.now()
              const storagePath = job.type === 'trellis'
                ? `items/${job.item_id}/${job.item_id}-${timestamp}.glb`
                : `items/${job.item_id}/images/processed-${timestamp}.png`

              const uploaded = await put(storagePath, blob, {
                access: 'public',
                contentType,
                allowOverwrite: true,
              })

              updates.result_urls = [uploaded.url]
              updates.download_urls = [trellisJob.download_url]

              console.log(`[poll-jobs] Uploaded result: ${uploaded.url}`)

              // Also update the item with the model path
              if (job.type === 'trellis') {
                await supabaseAdmin
                  .from('items')
                  .update({
                    model_path: uploaded.url,
                    generation_status: null,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', job.item_id)
              }
            }
          }

          // Handle failure
          if (trellisJob.status === 'failed') {
            updates.error = trellisJob.error || 'Job failed'

            // Reset item generation status
            await supabaseAdmin
              .from('items')
              .update({
                generation_status: null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', job.item_id)
          }

          // Update job in Supabase
          await supabaseAdmin
            .from('trellis_jobs')
            .update(updates)
            .eq('job_id', job.job_id)

          updated++
        }
      } catch (err) {
        console.error(`[poll-jobs] Error polling job ${job.job_id}:`, err)
      }
    }

    return NextResponse.json({
      polled: jobs.length,
      updated,
    })

  } catch (error) {
    console.error('[poll-jobs] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
