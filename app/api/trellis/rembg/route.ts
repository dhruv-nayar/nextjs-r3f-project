import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const itemId = formData.get('itemId') as string || `item-${Date.now()}`
    const imageUrls = formData.getAll('imageUrls') as string[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed' },
        { status: 400 }
      )
    }

    // Build FormData for Trellis API
    const trellisFormData = new FormData()
    for (const file of files) {
      trellisFormData.append('files', file)
    }

    // Add callback URL for webhook notification when job completes
    const callbackUrl = `${APP_URL}/api/webhooks/trellis`
    trellisFormData.append('callback_url', callbackUrl)

    console.log('[rembg] Submitting to Trellis async API...')

    // Call ASYNC endpoint
    const response = await fetch(`${TRELLIS_API_URL}/api/v1/rembg/async/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
      body: trellisFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[rembg] Trellis API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Trellis API error: ${response.status}`, detail: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[rembg] Async job submitted:', data.job_id)

    // Store job in Supabase for persistence
    const { error: insertError } = await supabaseAdmin
      .from('trellis_jobs')
      .insert({
        job_id: data.job_id,
        item_id: itemId,
        type: 'rembg',
        status: 'pending',
        progress: 0,
        message: 'Job submitted',
        input_image_urls: imageUrls.length > 0 ? imageUrls : null,
        callback_url: callbackUrl,
      })

    if (insertError) {
      console.error('[rembg] Failed to store job in Supabase:', insertError)
      // Continue anyway - webhook will still work
    }

    return NextResponse.json({
      job_id: data.job_id,
      status: 'pending',
      item_id: itemId,
    })

  } catch (error) {
    console.error('[rembg] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process background removal request' },
      { status: 500 }
    )
  }
}
