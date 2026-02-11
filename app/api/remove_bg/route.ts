import { NextRequest, NextResponse } from 'next/server'

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

    // In development, use local Python server on port 5001
    // In production on Vercel, the Python function will be at /api/remove_bg
    const isDevelopment = process.env.NODE_ENV === 'development'
    const pythonApiUrl = isDevelopment
      ? 'http://localhost:5001/api/remove_bg'
      : `/api/remove_bg`

    try {
      // Try to call the Python API
      const pythonResponse = await fetch(pythonApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      })

      if (pythonResponse.ok) {
        const result = await pythonResponse.json()
        return NextResponse.json(result)
      } else {
        console.log('Python API returned error:', pythonResponse.status)
      }
    } catch (pythonError) {
      // Python API not available (local dev), return original image
      console.log('Python API not available:', pythonError)
    }

    // Fallback: return original image without background removal
    // This allows the feature to work in local development
    return NextResponse.json({
      success: true,
      processedImageData: imageData,
      message: 'Background removal skipped (local development)'
    })

  } catch (error) {
    console.error('Background removal API error:', error)
    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500 }
    )
  }
}
