import { NextRequest, NextResponse } from 'next/server'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

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

    // Forward to Trellis API
    const trellisFormData = new FormData()
    for (const file of files) {
      trellisFormData.append('files', file)
    }

    const response = await fetch(`${TRELLIS_API_URL}/api/v1/rembg/`, {
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
    return NextResponse.json(data)

  } catch (error) {
    console.error('[rembg] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process background removal request' },
      { status: 500 }
    )
  }
}
