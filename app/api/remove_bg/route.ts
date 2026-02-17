import { NextRequest, NextResponse } from 'next/server'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

// Helper to poll for job completion
async function pollJobCompletion(jobId: string, maxAttempts = 60, intervalMs = 2000): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get job status: ${response.status}`)
    }

    const data = await response.json()

    if (data.status === 'completed') {
      return data
    } else if (data.status === 'failed') {
      throw new Error(data.error || 'Job failed')
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error('Job timed out')
}

// Helper to convert base64 data URL to Blob
function base64ToBlob(base64: string): Blob {
  // Handle data URL format
  const parts = base64.split(',')
  const mimeMatch = parts[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const data = parts.length > 1 ? parts[1] : parts[0]

  const byteCharacters = atob(data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mime })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageData } = body

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'Missing imageData in request' },
        { status: 400 }
      )
    }

    // Convert base64 to blob for FormData
    const imageBlob = base64ToBlob(imageData)
    const formData = new FormData()
    formData.append('files', imageBlob, 'image.png')

    // Submit to Modal rembg API
    console.log('[remove_bg] Submitting to Modal API...')
    const submitResponse = await fetch(`${TRELLIS_API_URL}/api/v1/rembg/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
      body: formData,
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      console.error('[remove_bg] Modal API error:', submitResponse.status, errorText)
      return NextResponse.json(
        { success: false, error: `Modal API error: ${submitResponse.status}` },
        { status: 500 }
      )
    }

    // Check content type - API may return image directly or job JSON
    const contentType = submitResponse.headers.get('content-type') || ''
    console.log('[remove_bg] Response content-type:', contentType)

    // If response is an image (returned directly), convert to base64
    if (contentType.includes('image/')) {
      console.log('[remove_bg] API returned image directly')
      const imageBuffer = await submitResponse.arrayBuffer()
      const base64Data = Buffer.from(imageBuffer).toString('base64')
      const mimeType = contentType.split(';')[0].trim()
      const processedImageData = `data:${mimeType};base64,${base64Data}`

      console.log('[remove_bg] Success, returning processed image')
      return NextResponse.json({
        success: true,
        processedImageData,
      })
    }

    // Otherwise, handle as async job
    const submitResult = await submitResponse.json()
    const jobId = submitResult.job_id

    console.log('[remove_bg] Job submitted:', jobId)

    // Poll for completion
    const completedJob = await pollJobCompletion(jobId)

    console.log('[remove_bg] Job completed:', completedJob)

    // Download the processed image
    if (!completedJob.download_urls || completedJob.download_urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No processed image returned' },
        { status: 500 }
      )
    }

    const downloadUrl = completedJob.download_urls[0]
    const filename = downloadUrl.split('/').pop() || 'processed.png'

    const downloadResponse = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${jobId}/download/${filename}`, {
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
    })

    if (!downloadResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to download processed image' },
        { status: 500 }
      )
    }

    // Convert to base64
    const processedBlob = await downloadResponse.blob()
    const arrayBuffer = await processedBlob.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const processedImageData = `data:image/png;base64,${base64Data}`

    console.log('[remove_bg] Success, returning processed image')

    return NextResponse.json({
      success: true,
      processedImageData,
    })

  } catch (error) {
    console.error('[remove_bg] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    )
  }
}
