import { NextRequest, NextResponse } from 'next/server'
import { uploadImage, validateImage } from '@/lib/storage/blob'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const removeBackground = formData.get('removeBackground') === 'true'
    const itemId = formData.get('itemId') as string || `item_${Date.now()}`

    // Validate number of files
    if (files.length === 0 || files.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Upload 1-10 images' },
        { status: 400 }
      )
    }

    // Validate each file
    for (const file of files) {
      const validation = validateImage(file)
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 }
        )
      }
    }

    // Upload images to Blob
    const uploadedUrls: string[] = []
    for (const file of files) {
      const url = await uploadImage(file, itemId, 'source')
      uploadedUrls.push(url)
    }

    // If background removal requested, process images
    if (removeBackground) {
      // For now, return URLs as-is
      // Future: Call Python function to process
      return NextResponse.json({
        success: true,
        imagePaths: uploadedUrls,
        message: 'Images uploaded. Background removal coming soon.'
      })
    }

    return NextResponse.json({
      success: true,
      imagePaths: uploadedUrls,
    })

  } catch (error) {
    console.error('Image upload failed:', error)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
