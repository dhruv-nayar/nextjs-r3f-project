import { NextRequest, NextResponse } from 'next/server'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const imageUrls = formData.getAll('imageUrls') as string[]
    const seed = formData.get('seed') as string || '1'
    const textureSize = formData.get('textureSize') as string || '2048'

    // Either files or imageUrls must be provided
    if ((!files || files.length === 0) && (!imageUrls || imageUrls.length === 0)) {
      return NextResponse.json(
        { error: 'No files or image URLs provided' },
        { status: 400 }
      )
    }

    const trellisFormData = new FormData()
    trellisFormData.append('seed', seed)
    trellisFormData.append('texture_size', textureSize)

    // If files are provided directly, use them
    if (files && files.length > 0) {
      for (const file of files) {
        trellisFormData.append('files', file)
      }
    }
    // If URLs are provided, fetch the images and add them
    else if (imageUrls && imageUrls.length > 0) {
      for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i]
        try {
          const imageResponse = await fetch(url)
          if (!imageResponse.ok) {
            console.error(`[generate-glb] Failed to fetch image: ${url}`)
            continue
          }
          const blob = await imageResponse.blob()
          const filename = `image_${i}.png`
          trellisFormData.append('files', blob, filename)
        } catch (fetchError) {
          console.error(`[generate-glb] Error fetching image ${url}:`, fetchError)
        }
      }
    }

    // Forward to Trellis API
    const response = await fetch(`${TRELLIS_API_URL}/api/v1/trellis/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
      body: trellisFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[generate-glb] Trellis API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Trellis API error: ${response.status}`, detail: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('[generate-glb] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start GLB generation' },
      { status: 500 }
    )
  }
}
