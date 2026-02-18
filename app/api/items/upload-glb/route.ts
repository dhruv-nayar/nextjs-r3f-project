import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { validateGLB } from '@/lib/storage/blob'

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('file') as File
    const itemId = formData.get('itemId') as string || `item_${Date.now()}`

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateGLB(file)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      )
    }

    // Upload to Vercel Blob
    const filename = `${itemId}-${Date.now()}.glb`
    const blob = await put(`items/${itemId}/${filename}`, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    })

    // Return URL
    return NextResponse.json({
      success: true,
      modelPath: blob.url,
      thumbnailPath: null, // Use category icon for now
    })

  } catch (error) {
    console.error('GLB upload failed:', error)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
