import { NextRequest, NextResponse } from 'next/server'

const TRELLIS_API_URL = process.env.TRELLIS_API_URL || 'https://nayardhruv0--trellis-api-fastapi-app.modal.run'
const TRELLIS_API_KEY = process.env.TRELLIS_API_KEY || ''

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[jobs] Trellis API error:', response.status, errorText)
      return NextResponse.json(
        { error: `Trellis API error: ${response.status}`, detail: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('[jobs] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    )
  }
}

// Cancel/delete a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${TRELLIS_API_URL}/api/v1/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TRELLIS_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[jobs] Delete error:', response.status, errorText)
      return NextResponse.json(
        { error: `Trellis API error: ${response.status}`, detail: errorText },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[jobs] Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
