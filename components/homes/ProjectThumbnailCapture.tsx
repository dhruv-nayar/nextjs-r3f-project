'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { useHome } from '@/lib/home-context'
import { calculateOverheadCameraPosition, OVERHEAD_CAMERA_CONFIG } from '@/lib/camera-utils'
import * as THREE from 'three'

interface ProjectThumbnailCaptureProps {
  homeId: string
  onCaptureComplete?: (thumbnailPath: string) => void
}

// Thumbnail size in pixels
const THUMBNAIL_SIZE = 512

/**
 * Component that captures the current 3D scene and uploads as project thumbnail.
 * Must be placed inside a Canvas component.
 * Captures are triggered by changes to the scene (debounced).
 *
 * Uses an offscreen canvas and separate renderer so the user's view
 * is never affected - completely invisible background process.
 *
 * Uses the same camera calculation as OverheadCameraSetup for consistency.
 */
export function ProjectThumbnailCapture({ homeId, onCaptureComplete }: ProjectThumbnailCaptureProps) {
  const { scene } = useThree()
  const { updateHomeThumbnail, currentHome } = useHome()
  const lastCaptureRef = useRef<string>('')
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isCapturingRef = useRef(false)

  // Offscreen renderer - created once and reused
  const offscreenRendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Initialize offscreen renderer
  useEffect(() => {
    // Create offscreen canvas
    const canvas = document.createElement('canvas')
    canvas.width = THUMBNAIL_SIZE
    canvas.height = THUMBNAIL_SIZE
    offscreenCanvasRef.current = canvas

    // Create offscreen renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    renderer.setClearColor(0xFAF9F6, 1) // Porcelain background
    offscreenRendererRef.current = renderer

    return () => {
      renderer.dispose()
      offscreenRendererRef.current = null
      offscreenCanvasRef.current = null
    }
  }, [])

  // Calculate a hash of the scene state to detect changes
  const getSceneHash = useCallback(() => {
    if (!currentHome) return ''

    // Create a simple hash based on instances across all rooms
    const instanceData = currentHome.rooms.map(room => {
      const instances = room.instances || []
      return instances.map(inst =>
        `${inst.id}:${inst.position.x},${inst.position.y},${inst.position.z}:${inst.rotation.x},${inst.rotation.y},${inst.rotation.z}`
      ).join('|')
    }).join('||')

    return instanceData
  }, [currentHome])

  const captureAndUpload = useCallback(async () => {
    if (isCapturingRef.current) return
    if (!offscreenRendererRef.current || !offscreenCanvasRef.current) return

    isCapturingRef.current = true

    try {
      const renderer = offscreenRendererRef.current
      const canvas = offscreenCanvasRef.current

      // Use shared camera calculation for consistency
      const cameraPos = calculateOverheadCameraPosition(scene)

      if (!cameraPos) {
        console.log('Scene is empty, skipping thumbnail capture')
        return
      }

      // Create temporary perspective camera with same FOV as config
      const thumbnailCamera = new THREE.PerspectiveCamera(
        OVERHEAD_CAMERA_CONFIG.fov,
        1,  // Aspect ratio (square thumbnail)
        0.1,
        1000
      )
      thumbnailCamera.position.copy(cameraPos.position)
      thumbnailCamera.lookAt(cameraPos.target)
      thumbnailCamera.updateMatrixWorld()

      // Render to offscreen canvas (user sees nothing)
      renderer.render(scene, thumbnailCamera)

      // Capture as blob from offscreen canvas
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })

      if (!blob) {
        console.error('Failed to capture canvas as blob')
        return
      }

      // Upload to API
      const formData = new FormData()
      formData.append('file', blob, 'thumbnail.png')
      formData.append('homeId', homeId)

      const response = await fetch('/api/homes/upload-thumbnail', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.thumbnailPath) {
          updateHomeThumbnail(homeId, data.thumbnailPath)
          onCaptureComplete?.(data.thumbnailPath)
        }
      } else {
        console.error('Failed to upload thumbnail:', await response.text())
      }
    } catch (error) {
      console.error('Error capturing/uploading thumbnail:', error)
    } finally {
      isCapturingRef.current = false
    }
  }, [scene, homeId, updateHomeThumbnail, onCaptureComplete])

  // Watch for scene changes and trigger debounced capture
  useEffect(() => {
    const currentHash = getSceneHash()

    // Skip if nothing changed
    if (currentHash === lastCaptureRef.current) return

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new debounced capture (2 second delay)
    debounceTimerRef.current = setTimeout(() => {
      lastCaptureRef.current = currentHash
      captureAndUpload()
    }, 2000)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [getSceneHash, captureAndUpload])

  // This component doesn't render anything visible
  return null
}
