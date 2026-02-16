'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useControls } from '@/lib/controls-context'
import { calculateOverheadCameraPosition, DEFAULT_CAMERA_POSITION } from '@/lib/camera-utils'

interface OverheadCameraSetupProps {
  /** Trigger recalculation when this changes (e.g., homeId or roomId) */
  triggerKey: string
  /** Delay before calculating camera position (allows scene to load) */
  delay?: number
}

/**
 * Calculates the optimal overhead camera position to fit the entire scene in view.
 * Uses the same calculation as thumbnail capture for consistency.
 *
 * This component should be placed inside a Canvas.
 */
export function OverheadCameraSetup({ triggerKey, delay = 300 }: OverheadCameraSetupProps) {
  const { scene } = useThree()
  const { controls } = useControls()
  const lastTriggerRef = useRef<string>('')

  useEffect(() => {
    // Skip if nothing changed
    if (triggerKey === lastTriggerRef.current) return
    if (!controls) return

    lastTriggerRef.current = triggerKey

    // Delay to allow scene objects to load
    const timer = setTimeout(() => {
      const cameraPos = calculateOverheadCameraPosition(scene)

      if (cameraPos) {
        // Animate camera to calculated position
        controls.setPosition(
          cameraPos.position.x,
          cameraPos.position.y,
          cameraPos.position.z,
          true
        )
        controls.setTarget(
          cameraPos.target.x,
          cameraPos.target.y,
          cameraPos.target.z,
          true
        )
      } else {
        // Fallback to default position if scene is empty
        controls.setPosition(
          DEFAULT_CAMERA_POSITION.position.x,
          DEFAULT_CAMERA_POSITION.position.y,
          DEFAULT_CAMERA_POSITION.position.z,
          true
        )
        controls.setTarget(
          DEFAULT_CAMERA_POSITION.target.x,
          DEFAULT_CAMERA_POSITION.target.y,
          DEFAULT_CAMERA_POSITION.target.z,
          true
        )
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [triggerKey, scene, controls, delay])

  return null
}
