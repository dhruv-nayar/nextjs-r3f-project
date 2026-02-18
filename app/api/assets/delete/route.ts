import { del } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'No URL provided' },
        { status: 400 }
      )
    }

    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[assets/delete] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete asset' },
      { status: 500 }
    )
  }
}
