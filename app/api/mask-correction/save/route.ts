import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { MaskCorrectionInsert } from '@/types/database'

/**
 * POST /api/mask-correction/save
 *
 * Saves a mask correction:
 * 1. Uploads the corrected mask PNG to Vercel Blob
 * 2. Uploads the corrected processed image to Vercel Blob
 * 3. Optionally extracts and saves the original mask from the original processed image
 * 4. Creates a record in the mask_corrections table for training data
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Required fields
    const maskFile = formData.get('maskFile') as File | null
    const processedFile = formData.get('processedFile') as File | null
    const itemId = formData.get('itemId') as string | null
    const imageIndexStr = formData.get('imageIndex') as string | null
    const originalUrl = formData.get('originalUrl') as string | null

    // Optional fields
    const originalProcessedUrl = formData.get('originalProcessedUrl') as string | null
    const metadataStr = formData.get('metadata') as string | null

    // Validate required fields
    if (!maskFile || !processedFile || !itemId || !imageIndexStr || !originalUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const imageIndex = parseInt(imageIndexStr, 10)
    if (isNaN(imageIndex) || imageIndex < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid image index' },
        { status: 400 }
      )
    }

    // Parse metadata
    let metadata: Record<string, unknown> | null = null
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr)
      } catch {
        console.warn('[mask-correction] Failed to parse metadata:', metadataStr)
      }
    }

    const timestamp = Date.now()

    // Upload corrected mask to Vercel Blob
    const maskFilename = `mask-corrected-${timestamp}.png`
    const maskBlob = await put(`items/${itemId}/masks/${maskFilename}`, maskFile, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    })
    const correctedMaskUrl = maskBlob.url

    // Upload corrected processed image to Vercel Blob
    const processedFilename = `processed-corrected-${timestamp}.png`
    const processedBlob = await put(`items/${itemId}/images/${processedFilename}`, processedFile, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      allowOverwrite: true,
    })
    const correctedProcessedUrl = processedBlob.url

    // If original processed URL exists, extract and save original mask for training pair
    let originalMaskUrl: string | null = null
    if (originalProcessedUrl) {
      try {
        // Fetch the original processed image
        const response = await fetch(originalProcessedUrl)
        if (response.ok) {
          const originalProcessedBlob = await response.blob()
          const originalMaskFilename = `mask-original-${timestamp}.png`
          const originalMaskBlobResult = await put(
            `items/${itemId}/masks/${originalMaskFilename}`,
            originalProcessedBlob,
            {
              access: 'public',
              token: process.env.BLOB_READ_WRITE_TOKEN,
              allowOverwrite: true,
            }
          )
          originalMaskUrl = originalMaskBlobResult.url
        }
      } catch (err) {
        console.warn('[mask-correction] Failed to save original mask:', err)
        // Continue without original mask - it's optional
      }
    }

    // Save to Supabase (mask_corrections table) for training data
    let correctionId: string | null = null
    try {
      const supabase = getSupabaseAdmin()

      const insertData: MaskCorrectionInsert = {
        item_id: itemId,
        image_index: imageIndex,
        original_url: originalUrl,
        original_mask_url: originalMaskUrl,
        corrected_mask_url: correctedMaskUrl,
        corrected_processed_url: correctedProcessedUrl,
        metadata: metadata
      }

      const { data, error } = await supabase
        .from('mask_corrections')
        .insert(insertData)
        .select('id')
        .single()

      if (error) {
        // Log error but don't fail the request - the images are saved
        console.warn('[mask-correction] Failed to save to database:', error)
      } else if (data) {
        correctionId = data.id
      }
    } catch (err) {
      // Log error but don't fail the request
      console.warn('[mask-correction] Database error:', err)
    }

    return NextResponse.json({
      success: true,
      correctionId,
      correctedMaskUrl,
      correctedProcessedUrl,
      originalMaskUrl
    })

  } catch (error) {
    console.error('[mask-correction] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save correction' },
      { status: 500 }
    )
  }
}
