import { put, del, list } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const homeId = formData.get('homeId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!homeId) {
      return NextResponse.json(
        { success: false, error: 'No homeId provided' },
        { status: 400 }
      )
    }

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Delete old thumbnails for this home
    try {
      const { blobs } = await list({
        prefix: `homes/${homeId}/thumbnail-`,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      // Delete old thumbnails
      for (const blob of blobs) {
        await del(blob.url, { token: process.env.BLOB_READ_WRITE_TOKEN })
      }
    } catch (e) {
      // Ignore errors when deleting old thumbnails
      console.log('Could not delete old thumbnails:', e)
    }

    // Upload to Vercel Blob
    const filename = `thumbnail-${homeId}-${Date.now()}.png`
    const blob = await put(`homes/${homeId}/${filename}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    // Return thumbnail URL
    return NextResponse.json({
      success: true,
      thumbnailPath: blob.url
    })

  } catch (error) {
    console.error('Home thumbnail upload failed:', error)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
