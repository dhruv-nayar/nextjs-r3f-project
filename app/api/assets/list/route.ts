import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

export interface Asset {
  url: string
  pathname: string
  size: number
  uploadedAt: string
  type: 'image' | 'model' | 'thumbnail'
  subtype?: 'original' | 'processed'
  itemId?: string
  homeId?: string
}

function categorizeAsset(pathname: string): Partial<Asset> {
  // Items images: items/{itemId}/images/source-* or processed-*
  const itemImageMatch = pathname.match(/^items\/([^/]+)\/images\/(source|processed)-/)
  if (itemImageMatch) {
    return {
      type: 'image',
      subtype: itemImageMatch[2] as 'original' | 'processed',
      itemId: itemImageMatch[1],
    }
  }

  // Items GLB models: items/{itemId}/*.glb
  const glbMatch = pathname.match(/^items\/([^/]+)\/[^/]+\.glb$/)
  if (glbMatch) {
    return {
      type: 'model',
      itemId: glbMatch[1],
    }
  }

  // Items thumbnails: items/{itemId}/thumbnail-*
  const itemThumbMatch = pathname.match(/^items\/([^/]+)\/thumbnail-/)
  if (itemThumbMatch) {
    return {
      type: 'thumbnail',
      itemId: itemThumbMatch[1],
    }
  }

  // Homes thumbnails: homes/{homeId}/thumbnail-*
  const homeThumbMatch = pathname.match(/^homes\/([^/]+)\/thumbnail-/)
  if (homeThumbMatch) {
    return {
      type: 'thumbnail',
      homeId: homeThumbMatch[1],
    }
  }

  // Unknown - categorize by extension
  if (pathname.endsWith('.glb')) {
    return { type: 'model' }
  }
  if (pathname.match(/\.(jpg|jpeg|png|webp)$/i)) {
    return { type: 'image' }
  }

  return { type: 'image' } // Default
}

export async function GET() {
  try {
    const assets: Asset[] = []
    let cursor: string | undefined

    // Paginate through all blobs
    do {
      const response = await list({
        token: process.env.BLOB_READ_WRITE_TOKEN,
        cursor,
        limit: 1000,
      })

      for (const blob of response.blobs) {
        const category = categorizeAsset(blob.pathname)
        assets.push({
          url: blob.url,
          pathname: blob.pathname,
          size: blob.size,
          uploadedAt: blob.uploadedAt.toISOString(),
          type: category.type || 'image',
          subtype: category.subtype,
          itemId: category.itemId,
          homeId: category.homeId,
        })
      }

      cursor = response.cursor
    } while (cursor)

    // Sort by upload date (newest first)
    assets.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )

    return NextResponse.json({
      success: true,
      assets,
      count: assets.length,
    })

  } catch (error) {
    console.error('[assets/list] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list assets' },
      { status: 500 }
    )
  }
}
