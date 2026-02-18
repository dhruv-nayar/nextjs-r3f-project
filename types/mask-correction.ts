// Types for mask correction feature

/**
 * Canvas state for the mask correction editor
 */
export interface CanvasState {
  brushSize: number
  tool: 'brush' | 'eraser'
  zoom: number
  pan: { x: number; y: number }
}

/**
 * Metadata captured during mask correction session
 * Used for training data labeling and analytics
 */
export interface MaskCorrectionMetadata {
  brushSizes: number[]        // Brush sizes used during correction
  toolsUsed: ('brush' | 'eraser')[]  // Tools used
  correctionDuration: number  // Total editing time in milliseconds
  pixelsModified?: number     // Approximate count of modified pixels
  imageWidth: number          // Original image dimensions
  imageHeight: number
}

/**
 * Data structure for saving a mask correction
 */
export interface MaskCorrectionData {
  itemId: string
  imageIndex: number
  originalUrl: string
  originalMaskUrl?: string        // Alpha extracted from original processed image
  correctedMaskUrl: string        // User's corrected mask
  correctedProcessedUrl: string   // Final processed image with corrected mask applied
  metadata?: MaskCorrectionMetadata
}

/**
 * API response from saving a mask correction
 */
export interface SaveMaskCorrectionResponse {
  success: boolean
  correctionId?: string
  correctedMaskUrl?: string
  correctedProcessedUrl?: string
  originalMaskUrl?: string
  error?: string
}

/**
 * Props for the MaskCorrectionModal component
 */
export interface MaskCorrectionModalProps {
  isOpen: boolean
  onClose: () => void
  imagePair: {
    original: string
    processed: string | null
  }
  itemId: string
  imageIndex: number
  onCorrectionSaved: (newProcessedUrl: string) => void
}

/**
 * History state for undo/redo in mask editor
 */
export interface MaskHistoryState {
  past: ImageData[]
  present: ImageData | null
  future: ImageData[]
}

/**
 * Training data labels for mask corrections
 */
export type TrainingLabel = 'approved' | 'rejected' | 'needs_review'
