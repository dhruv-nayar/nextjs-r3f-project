'use client'

import { useState, useEffect } from 'react'
import { useTrellisJobs } from '@/lib/trellis-job-context'
import { ImagePair } from '@/types/room'
import Image from 'next/image'

interface GenerateModelPanelProps {
  itemId: string
  imagePairs: ImagePair[]
  onModelGenerated?: (modelPath: string) => void
}

export function GenerateModelPanel({
  itemId,
  imagePairs,
  onModelGenerated,
}: GenerateModelPanelProps) {
  const { addJob, getJobsForItem, activeGlbJob } = useTrellisJobs()
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get the current GLB job for this item
  const itemJobs = getJobsForItem(itemId)
  const currentGlbJob = itemJobs.find(
    job => job.type === 'trellis' && (job.status === 'pending' || job.status === 'processing')
  )

  // Filter to only processed images (background removed)
  const processedImages = imagePairs.filter(pair => pair.processed !== null)

  // Listen for GLB completion event
  useEffect(() => {
    const handleGlbComplete = (event: CustomEvent<{ itemId: string; modelPath: string; jobId: string }>) => {
      if (event.detail.itemId === itemId) {
        onModelGenerated?.(event.detail.modelPath)
      }
    }

    window.addEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    return () => {
      window.removeEventListener('trellis-glb-complete', handleGlbComplete as EventListener)
    }
  }, [itemId, onModelGenerated])

  const toggleImage = (index: number) => {
    const newSelected = new Set(selectedImages)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedImages(newSelected)
  }

  const handleGenerate = async () => {
    if (selectedImages.size === 0) {
      setError('Please select at least one image')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Get the URLs of selected processed images
      const selectedUrls = Array.from(selectedImages).map(
        index => processedImages[index].processed!
      )

      // Create form data with image URLs
      const formData = new FormData()
      for (const url of selectedUrls) {
        formData.append('imageUrls', url)
      }
      formData.append('seed', '1')
      formData.append('textureSize', '2048')

      // Submit to API
      const response = await fetch('/api/trellis/generate-glb', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start model generation')
      }

      const data = await response.json()

      // Add job to context for tracking
      addJob({
        jobId: data.job_id,
        itemId,
        type: 'trellis',
        status: 'pending',
        progress: 0,
        message: 'Starting model generation...',
        inputImageUrls: selectedUrls,
      })

      // Clear selection
      setSelectedImages(new Set())

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation')
    } finally {
      setIsSubmitting(false)
    }
  }

  // If there are no processed images, show a message
  if (processedImages.length === 0) {
    return (
      <div className="bg-taupe/5 rounded-lg p-6 border border-taupe/10">
        <h3 className="font-body font-medium text-graphite mb-2">Generate 3D Model</h3>
        <p className="text-sm text-taupe/70">
          Upload images and wait for background removal to complete before generating a 3D model.
        </p>
      </div>
    )
  }

  // If there's an active job, show progress
  if (currentGlbJob) {
    return (
      <div className="bg-taupe/5 rounded-lg p-6 border border-taupe/10">
        <h3 className="font-body font-medium text-graphite mb-4">Generating 3D Model</h3>

        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-taupe/20 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-sage transition-all duration-300 ease-out"
              style={{ width: `${currentGlbJob.progress || 5}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-taupe/70">
              {currentGlbJob.message || 'Processing...'}
            </span>
            <span className="text-graphite font-medium">
              {currentGlbJob.progress || 0}%
            </span>
          </div>

          <p className="text-xs text-taupe/50">
            This typically takes 1-3 minutes. You can navigate away and come back.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-taupe/5 rounded-lg p-6 border border-taupe/10">
      <h3 className="font-body font-medium text-graphite mb-2">Generate 3D Model</h3>
      <p className="text-sm text-taupe/70 mb-4">
        Select background-removed images to generate a 3D model.
      </p>

      {/* Image selection grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {processedImages.map((pair, index) => (
          <button
            key={index}
            type="button"
            onClick={() => toggleImage(index)}
            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
              selectedImages.has(index)
                ? 'border-sage ring-2 ring-sage/30'
                : 'border-taupe/20 hover:border-taupe/40'
            }`}
          >
            <div className="absolute inset-0 bg-[url('/checkerboard.svg')] bg-repeat" />
            <Image
              src={pair.processed!}
              alt={`Image ${index + 1}`}
              fill
              className="object-contain relative z-10"
              unoptimized
            />
            {selectedImages.has(index) && (
              <div className="absolute top-1 right-1 w-5 h-5 bg-sage rounded-full flex items-center justify-center z-20">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-scarlet/10 border border-scarlet/20 rounded-lg text-sm text-scarlet">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={selectedImages.size === 0 || isSubmitting || !!activeGlbJob}
        className={`w-full py-3 rounded-lg font-body font-medium transition-colors ${
          selectedImages.size > 0 && !isSubmitting && !activeGlbJob
            ? 'bg-graphite text-white hover:bg-graphite/90'
            : 'bg-taupe/20 text-taupe/50 cursor-not-allowed'
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Starting...
          </span>
        ) : activeGlbJob ? (
          'Another model is generating...'
        ) : selectedImages.size > 0 ? (
          `Generate from ${selectedImages.size} image${selectedImages.size > 1 ? 's' : ''}`
        ) : (
          'Select images to generate'
        )}
      </button>

      <p className="text-xs text-taupe/50 mt-2 text-center">
        Generation takes 1-3 minutes
      </p>
    </div>
  )
}
