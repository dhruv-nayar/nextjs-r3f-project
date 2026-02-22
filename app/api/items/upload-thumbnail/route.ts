import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const itemId = formData.get('itemId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: 'No itemId provided' },
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

    // Use a fixed filename and overwrite - prevents accumulation of old thumbnails
    const filename = `thumbnail.png`
    const blob = await put(`items/${itemId}/${filename}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,  // Use exact filename for overwrite
    })

    // Return thumbnail URL
    return NextResponse.json({
      success: true,
      thumbnailPath: blob.url
    })

  } catch (error) {
    console.error('Thumbnail upload failed:', error)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
