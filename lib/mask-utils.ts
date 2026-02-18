/**
 * Utility functions for mask manipulation in the background removal correction feature
 * These functions handle extracting masks from processed images and applying masks to originals
 */

/**
 * Load an image from a URL and draw it to a canvas
 * Returns the canvas and its 2D context
 */
export async function loadImageToCanvas(imageUrl: string): Promise<{
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas 2D context'))
        return
      }

      ctx.drawImage(img, 0, 0)
      resolve({
        canvas,
        ctx,
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageUrl}`))
    }

    img.src = imageUrl
  })
}

/**
 * Extract the alpha channel from a processed (transparent) PNG image
 * Returns an ImageData where the alpha values represent the mask
 * White (255) = foreground, Black (0) = background
 */
export async function extractMaskFromProcessed(processedUrl: string): Promise<ImageData> {
  const { ctx, width, height } = await loadImageToCanvas(processedUrl)
  const imageData = ctx.getImageData(0, 0, width, height)

  // Convert alpha channel to grayscale mask
  // The mask will be stored in RGBA format where R=G=B=Alpha value
  const maskData = new ImageData(width, height)

  for (let i = 0; i < imageData.data.length; i += 4) {
    const alpha = imageData.data[i + 3] // Alpha channel
    // Store alpha as grayscale (white = foreground, black = background)
    maskData.data[i] = alpha     // R
    maskData.data[i + 1] = alpha // G
    maskData.data[i + 2] = alpha // B
    maskData.data[i + 3] = 255   // A (fully opaque for display)
  }

  return maskData
}

/**
 * Apply a mask to an original image to create a new processed (transparent) image
 * The mask's R channel (or any channel, they should be equal) is used as alpha
 *
 * @param originalUrl - URL of the original image
 * @param maskImageData - ImageData containing the mask (R=G=B=mask value)
 * @returns Blob of the processed PNG image
 */
export async function applyMaskToOriginal(
  originalUrl: string,
  maskImageData: ImageData
): Promise<Blob> {
  const { ctx, width, height } = await loadImageToCanvas(originalUrl)

  // Validate dimensions match
  if (width !== maskImageData.width || height !== maskImageData.height) {
    throw new Error(`Mask dimensions (${maskImageData.width}x${maskImageData.height}) don't match original (${width}x${height})`)
  }

  const originalData = ctx.getImageData(0, 0, width, height)

  // Apply mask: set alpha channel of original to mask value
  for (let i = 0; i < originalData.data.length; i += 4) {
    // Use the R channel of the mask as the alpha value
    originalData.data[i + 3] = maskImageData.data[i]
  }

  // Put the modified image data back
  ctx.putImageData(originalData, 0, 0)

  // Convert to blob
  return canvasToBlob(ctx.canvas)
}

/**
 * Convert an HTMLCanvasElement to a PNG Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      },
      'image/png',
      1.0 // Maximum quality
    )
  })
}

/**
 * Convert ImageData to a PNG Blob
 * Creates a temporary canvas to render the ImageData
 */
export function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas 2D context'))
  }

  ctx.putImageData(imageData, 0, 0)
  return canvasToBlob(canvas)
}

/**
 * Create an empty mask ImageData (all transparent/background)
 */
export function createEmptyMask(width: number, height: number): ImageData {
  const maskData = new ImageData(width, height)
  // All pixels start as 0 (background/transparent)
  // Alpha channel is set to 255 for display purposes
  for (let i = 0; i < maskData.data.length; i += 4) {
    maskData.data[i] = 0       // R - mask value (0 = background)
    maskData.data[i + 1] = 0   // G
    maskData.data[i + 2] = 0   // B
    maskData.data[i + 3] = 255 // A - fully opaque for display
  }
  return maskData
}

/**
 * Create a full mask ImageData (all foreground)
 */
export function createFullMask(width: number, height: number): ImageData {
  const maskData = new ImageData(width, height)
  for (let i = 0; i < maskData.data.length; i += 4) {
    maskData.data[i] = 255     // R - mask value (255 = foreground)
    maskData.data[i + 1] = 255 // G
    maskData.data[i + 2] = 255 // B
    maskData.data[i + 3] = 255 // A - fully opaque for display
  }
  return maskData
}

/**
 * Clone an ImageData object
 */
export function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  )
}

/**
 * Calculate the approximate number of foreground pixels in a mask
 * Useful for tracking how much of the image is selected
 */
export function countForegroundPixels(maskImageData: ImageData): number {
  let count = 0
  for (let i = 0; i < maskImageData.data.length; i += 4) {
    // Count pixels where mask value > 128 as foreground
    if (maskImageData.data[i] > 128) {
      count++
    }
  }
  return count
}

/**
 * Calculate the difference in pixels between two masks
 * Returns the count of pixels that changed
 */
export function countMaskDifference(mask1: ImageData, mask2: ImageData): number {
  if (mask1.width !== mask2.width || mask1.height !== mask2.height) {
    throw new Error('Masks must have the same dimensions')
  }

  let count = 0
  for (let i = 0; i < mask1.data.length; i += 4) {
    // Check if the mask value changed significantly (threshold of 64)
    if (Math.abs(mask1.data[i] - mask2.data[i]) > 64) {
      count++
    }
  }
  return count
}

/**
 * Get image dimensions from a URL without loading the full image
 */
export function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }

    img.onerror = () => {
      reject(new Error(`Failed to load image dimensions: ${imageUrl}`))
    }

    img.src = imageUrl
  })
}
