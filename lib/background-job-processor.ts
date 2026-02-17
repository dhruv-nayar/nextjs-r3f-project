/**
 * Background job processor - runs in the browser and processes jobs from the queue
 * Continues processing even after page refresh by reading from localStorage
 */

'use client'

import {
  getAllJobs,
  getJob,
  updateJob,
  completeJob,
  failJob,
  cleanupOldJobs,
  BackgroundJob,
  JobStatus
} from './background-jobs'
import { useItemLibrary } from './item-library-context'

const POLL_INTERVAL = 2000 // Poll every 2 seconds
const MAX_CONCURRENT_JOBS = 2 // Process max 2 jobs at a time

/**
 * Process a single rembg job
 */
async function processRembgJob(job: BackgroundJob): Promise<void> {
  if (!job.input.originalImageBase64 && !job.input.originalImageUrl) {
    throw new Error('No image data provided for rembg job')
  }

  // Update status to processing
  updateJob(job.id, { status: 'processing', progress: 10 })

  // Get image data
  let imageData = job.input.originalImageBase64

  if (!imageData && job.input.originalImageUrl) {
    // Convert URL to base64
    const response = await fetch(job.input.originalImageUrl)
    const blob = await response.blob()
    imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  updateJob(job.id, { progress: 30 })

  // Call rembg API
  const rembgResponse = await fetch('/api/remove_bg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData })
  })

  if (!rembgResponse.ok) {
    const errorData = await rembgResponse.json()
    throw new Error(errorData.error || 'Background removal failed')
  }

  const rembgResult = await rembgResponse.json()

  if (!rembgResult.success) {
    throw new Error(rembgResult.error || 'Background removal failed')
  }

  updateJob(job.id, { progress: 70 })

  // Upload processed image
  const processedBase64 = rembgResult.processedImageData
  const processedBlob = await fetch(processedBase64).then(r => r.blob())
  const processedFile = new File(
    [processedBlob],
    `processed_${Date.now()}.png`,
    { type: 'image/png' }
  )

  const uploadFormData = new FormData()
  uploadFormData.append('files', processedFile)
  uploadFormData.append('itemId', job.itemId)

  const uploadResponse = await fetch('/api/items/upload-images', {
    method: 'POST',
    body: uploadFormData
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload processed image')
  }

  const uploadResult = await uploadResponse.json()

  if (!uploadResult.success) {
    throw new Error(uploadResult.error || 'Failed to upload processed image')
  }

  updateJob(job.id, { progress: 95 })

  // Complete job with output
  completeJob(job.id, {
    processedImageUrl: uploadResult.imagePaths[0]
  })
}

/**
 * Process a single GLB generation job
 */
async function processGlbJob(job: BackgroundJob): Promise<void> {
  if (!job.input.imageUrls || job.input.imageUrls.length === 0) {
    throw new Error('No image URLs provided for GLB generation')
  }

  // Update status to processing
  updateJob(job.id, { status: 'processing', progress: 10 })

  // Call GLB generation API
  const response = await fetch('/api/generate-glb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: job.itemId,
      imageUrls: job.input.imageUrls
    })
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'GLB generation failed')
  }

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.error || 'GLB generation failed')
  }

  updateJob(job.id, { progress: 95 })

  // Complete job with output
  completeJob(job.id, {
    glbUrl: result.glbUrl
  })
}

/**
 * Process a single job based on its type
 */
async function processJob(job: BackgroundJob): Promise<void> {
  try {
    switch (job.type) {
      case 'rembg':
        await processRembgJob(job)
        break
      case 'glb_generation':
        await processGlbJob(job)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
  } catch (error) {
    console.error(`Job ${job.id} failed:`, error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    failJob(job.id, errorMessage)
  }
}

/**
 * Get jobs that are ready to process
 */
function getProcessableJobs(maxJobs: number): BackgroundJob[] {
  const jobs = getAllJobs()

  // Get pending jobs
  const pendingJobs = jobs.filter(j => j.status === 'pending')

  // Sort by creation time (oldest first)
  pendingJobs.sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return pendingJobs.slice(0, maxJobs)
}

/**
 * Background job processor class
 */
export class BackgroundJobProcessor {
  private isRunning = false
  private processingJobIds = new Set<string>()
  private pollInterval: NodeJS.Timeout | null = null

  /**
   * Start the background job processor
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Background job processor is already running')
      return
    }

    this.isRunning = true
    console.log('Starting background job processor...')

    // Clean up old jobs on start
    const cleaned = cleanupOldJobs()
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old jobs`)
    }

    // Start polling
    this.poll()
    this.pollInterval = setInterval(() => this.poll(), POLL_INTERVAL)
  }

  /**
   * Stop the background job processor
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    console.log('Background job processor stopped')
  }

  /**
   * Poll for jobs and process them
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return

    try {
      // Get available slots
      const availableSlots = MAX_CONCURRENT_JOBS - this.processingJobIds.size

      if (availableSlots <= 0) return

      // Get jobs to process
      const jobs = getProcessableJobs(availableSlots)

      if (jobs.length === 0) return

      // Process each job
      for (const job of jobs) {
        if (this.processingJobIds.has(job.id)) continue

        this.processingJobIds.add(job.id)

        // Process job asynchronously
        processJob(job)
          .finally(() => {
            this.processingJobIds.delete(job.id)
          })
      }
    } catch (error) {
      console.error('Error in background job processor poll:', error)
    }
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean
    processingCount: number
  } {
    return {
      isRunning: this.isRunning,
      processingCount: this.processingJobIds.size
    }
  }
}

// Create global singleton instance
let globalProcessor: BackgroundJobProcessor | null = null

/**
 * Get or create the global background job processor
 */
export function getBackgroundJobProcessor(): BackgroundJobProcessor {
  if (typeof window === 'undefined') {
    throw new Error('BackgroundJobProcessor can only be used in the browser')
  }

  if (!globalProcessor) {
    globalProcessor = new BackgroundJobProcessor()
  }

  return globalProcessor
}

/**
 * Start the global background job processor
 */
export function startBackgroundJobProcessor(): void {
  const processor = getBackgroundJobProcessor()
  processor.start()
}

/**
 * Stop the global background job processor
 */
export function stopBackgroundJobProcessor(): void {
  if (globalProcessor) {
    globalProcessor.stop()
  }
}
