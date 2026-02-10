import { FloorplanConfig } from '@/types/room'

/**
 * Calculate pixels per foot based on image dimensions and real-world dimensions
 */
export function calculatePixelsPerFoot(
  imageWidthPixels: number,
  imageHeightPixels: number,
  realWidthFeet: number,
  realHeightFeet: number
): number {
  const xRatio = imageWidthPixels / realWidthFeet
  const yRatio = imageHeightPixels / realHeightFeet

  // Use average to handle slight aspect ratio differences
  return (xRatio + yRatio) / 2
}

/**
 * Convert pixel coordinates to Three.js units (feet)
 */
export function pixelsToFeet(
  pixels: number,
  pixelsPerFoot: number
): number {
  return pixels / pixelsPerFoot
}

/**
 * Convert Three.js units (feet) to pixel coordinates
 */
export function feetToPixels(
  feet: number,
  pixelsPerFoot: number
): number {
  return feet * pixelsPerFoot
}

/**
 * Get floorplan mesh scale based on real-world dimensions
 */
export function getFloorplanScale(
  floorplan: FloorplanConfig,
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  // Calculate scale to match real-world dimensions
  // Three.js plane is 1x1 by default, so scale it to match feet
  return {
    width: floorplan.widthFeet,
    height: floorplan.heightFeet
  }
}

/**
 * Validate floorplan dimensions
 */
export function validateFloorplanDimensions(
  widthFeet: number,
  heightFeet: number,
  maxWidth: number = 100,
  maxHeight: number = 100
): { valid: boolean; error?: string } {
  if (widthFeet <= 0 || heightFeet <= 0) {
    return { valid: false, error: 'Dimensions must be positive numbers' }
  }

  if (widthFeet > maxWidth) {
    return { valid: false, error: `Width cannot exceed ${maxWidth} feet` }
  }

  if (heightFeet > maxHeight) {
    return { valid: false, error: `Height cannot exceed ${maxHeight} feet` }
  }

  return { valid: true }
}
