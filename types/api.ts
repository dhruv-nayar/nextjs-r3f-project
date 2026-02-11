import { ItemCategory } from './room'

// ============================================
// Request Types
// ============================================

export interface UploadGLBRequest {
  file: File
  itemName: string
}

export interface RemoveBackgroundRequest {
  imageUrl: string
}

export interface CreateItemRequest {
  name: string
  description?: string
  category: ItemCategory
  tags: string[]
  dimensions: {
    width: number
    height: number
    depth: number
  }
  modelPath: string
  thumbnailPath?: string
}

// ============================================
// Response Types
// ============================================

export interface UploadGLBResponse {
  success: boolean
  modelPath: string
  thumbnailPath?: string
  error?: string
}

export interface RemoveBackgroundResponse {
  success: boolean
  processedImageUrl?: string
  error?: string
  message?: string
}

export interface ImageToGLBResponse {
  success: boolean
  jobId?: string
  error?: string
  message?: string
}
