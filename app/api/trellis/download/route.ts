import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

/**
 * Download a file from Trellis API and upload to Vercel Blob
 * Used for persisting generated GLB models and processed images
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobId, filename, itemId, type } = body

    if (!jobId || !filename || !itemId) {
      return NextResponse.json(
        { error: 'jobId, filename, and itemId are required' },
        { status: 400 }
      )
    }

    // Download from Trellis API
    const downloadUrl = `${TRELLIS_API_URL}/api/v1/jobs/${jobId}/download/${filename}`
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[download] Trellis download error:', response.status, errorText)
      return NextResponse.json(
        { error: `Failed to download from Trellis: ${response.status}` },
        { status: response.status }
      )
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Determine storage path based on type
    let storagePath: string
    let blobFilename: string

    if (type === 'glb' || filename.endsWith('.glb')) {
      blobFilename = `${itemId}-${Date.now()}.glb`
      storagePath = `items/${itemId}/${blobFilename}`
    } else if (type === 'image' || filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
      blobFilename = `processed-${Date.now()}-${filename}`
      storagePath = `items/${itemId}/images/${blobFilename}`
    } else {
      blobFilename = `${Date.now()}-${filename}`
      storagePath = `items/${itemId}/${blobFilename}`
    }

    // Upload to Vercel Blob
    const uploadedBlob = await put(storagePath, blob, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType,
    })

    return NextResponse.json({
      success: true,
      url: uploadedBlob.url,
      filename: blobFilename,
      type: type || (filename.endsWith('.glb') ? 'glb' : 'image'),
    })

  } catch (error) {
    console.error('[download] Error:', error)
    return NextResponse.json(
      { error: 'Failed to download and store file' },
      { status: 500 }
    )
  }
}
