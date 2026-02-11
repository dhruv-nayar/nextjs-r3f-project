import { put, del } from '@vercel/blob'

// Configuration
const MAX_GLB_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB per image
const ALLOWED_GLB_TYPES = ['model/gltf-binary', 'application/octet-stream']
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Upload GLB file to Vercel Blob
export async function uploadGLB(
  file: File,
  itemId: string
): Promise<string> {
  const filename = `${itemId}-${Date.now()}.glb`
  const blob = await put(`items/${itemId}/${filename}`, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

// Upload image to Vercel Blob
export async function uploadImage(
  file: File,
  itemId: string,
  type: 'thumbnail' | 'source' | 'processed'
): Promise<string> {
  const filename = `${type}-${Date.now()}-${file.name}`
  const blob = await put(`items/${itemId}/images/${filename}`, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

// Delete file from Vercel Blob
export async function deleteBlob(url: string): Promise<void> {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
}

// Validate GLB file
export function validateGLB(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_GLB_SIZE) {
    return { valid: false, error: `File too large. Max ${MAX_GLB_SIZE / 1024 / 1024}MB` }
  }
  if (!file.name.endsWith('.glb')) {
    return { valid: false, error: 'File must be a .glb file' }
  }
  return { valid: true }
}

// Validate image file
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Image too large. Max ${MAX_IMAGE_SIZE / 1024 / 1024}MB` }
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Image must be JPG, PNG, or WebP' }
  }
  return { valid: true }
}
