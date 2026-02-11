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

    // In development, use local Python Flask server on port 5001
    // In production on Vercel, call the Python serverless function
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (isDevelopment) {
      // Development: call local Flask server
      try {
        const pythonResponse = await fetch('http://localhost:5001/api/remove_bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData })
        })

        if (pythonResponse.ok) {
          const result = await pythonResponse.json()
          return NextResponse.json(result)
        } else {
          console.log('Local Python server error:', pythonResponse.status)
        }
      } catch (error) {
        console.log('Local Python server not available:', error)
      }

      // Fallback in development: return original image
      return NextResponse.json({
        success: true,
        processedImageData: imageData,
        message: 'Background removal skipped (local server not running)'
      })
    } else {
      // Production: call Vercel Python serverless function
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : request.nextUrl.origin

      const pythonResponse = await fetch(`${baseUrl}/api/remove_bg_python`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData })
      })

      if (pythonResponse.ok) {
        const result = await pythonResponse.json()
        return NextResponse.json(result)
      } else {
        throw new Error(`Python function returned ${pythonResponse.status}`)
      }
    }

  } catch (error) {
    console.error('Background removal API error:', error)
    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500 }
    )
  }
}
