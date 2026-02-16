'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { SurfaceGridSettings } from '@/types/selection'

interface MeasurementGridProps {
  width: number           // Width in feet
  height: number          // Height in feet (for walls) or depth (for floor)
  settings: SurfaceGridSettings
  position: [number, number, number]
  rotation?: [number, number, number]
}

/**
 * MeasurementGrid: Renders a Figma-style grid overlay on surfaces
 * Shows grid lines and optional ruler marks along edges
 */
export function MeasurementGrid({
  width,
  height,
  settings,
  position,
  rotation = [0, 0, 0],
}: MeasurementGridProps) {
  const { enabled, spacing, showRulers } = settings

  // Don't render if disabled
  if (!enabled) return null

  // Create grid lines geometry - CENTERED on origin
  const gridGeometry = useMemo(() => {
    const points: THREE.Vector3[] = []

    // Vertical lines (along height/depth axis) - centered
    const numVerticalLines = Math.floor(width / spacing) + 1
    const startX = -width / 2
    for (let i = 0; i < numVerticalLines; i++) {
      const x = startX + i * spacing
      if (x > width / 2) break
      // Lines go from -height/2 to +height/2 (centered)
      points.push(new THREE.Vector3(x, -height / 2, 0))
      points.push(new THREE.Vector3(x, height / 2, 0))
    }

    // Horizontal lines (along width axis) - centered
    const numHorizontalLines = Math.floor(height / spacing) + 1
    const startY = -height / 2
    for (let i = 0; i < numHorizontalLines; i++) {
      const y = startY + i * spacing
      if (y > height / 2) break
      points.push(new THREE.Vector3(-width / 2, y, 0))
      points.push(new THREE.Vector3(width / 2, y, 0))
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    return geometry
  }, [width, height, spacing])

  // Create ruler tick marks - CENTERED on origin
  const rulerGeometry = useMemo(() => {
    if (!showRulers) return null

    const points: THREE.Vector3[] = []
    const tickLength = 0.15 // 0.15 feet tick marks

    // Bottom ruler (tick marks along width at y = -height/2)
    const numWidthTicks = Math.floor(width / spacing) + 1
    const startX = -width / 2
    for (let i = 0; i < numWidthTicks; i++) {
      const x = startX + i * spacing
      if (x > width / 2) break
      // Tick pointing up from bottom edge
      points.push(new THREE.Vector3(x, -height / 2, 0.01))
      points.push(new THREE.Vector3(x, -height / 2 + tickLength, 0.01))
    }

    // Left ruler (tick marks along height at x = -width/2)
    const numHeightTicks = Math.floor(height / spacing) + 1
    const startY = -height / 2
    for (let i = 0; i < numHeightTicks; i++) {
      const y = startY + i * spacing
      if (y > height / 2) break
      // Tick pointing right from left edge
      points.push(new THREE.Vector3(-width / 2, y, 0.01))
      points.push(new THREE.Vector3(-width / 2 + tickLength, y, 0.01))
    }

    return new THREE.BufferGeometry().setFromPoints(points)
  }, [width, height, spacing, showRulers])

  return (
    <group position={position} rotation={rotation}>
      {/* Grid lines */}
      <lineSegments position={[0, 0, 0.02]}>
        <primitive object={gridGeometry} attach="geometry" />
        <lineBasicMaterial
          color="#ff6600"
          transparent
          opacity={0.5}
          depthTest={true}
        />
      </lineSegments>

      {/* Ruler tick marks */}
      {rulerGeometry && (
        <lineSegments position={[0, 0, 0.03]}>
          <primitive object={rulerGeometry} attach="geometry" />
          <lineBasicMaterial
            color="#ff6600"
            transparent
            opacity={0.9}
            depthTest={true}
          />
        </lineSegments>
      )}
    </group>
  )
}

/**
 * FloorMeasurementGrid: Convenience wrapper for floor grids (horizontal)
 * NOTE: This component should be rendered INSIDE the room group,
 * so position is relative to the room origin (0,0,0)
 */
interface FloorGridProps {
  width: number
  depth: number
  settings: SurfaceGridSettings
  roomPosition: [number, number, number]  // Kept for API compatibility but not used
}

export function FloorMeasurementGrid({
  width,
  depth,
  settings,
}: FloorGridProps) {
  if (!settings.enabled) return null

  // Position at floor level (y=0.01 to avoid z-fighting), centered on room origin
  return (
    <MeasurementGrid
      width={width}
      height={depth}
      settings={settings}
      position={[0, 0.01, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  )
}

/**
 * WallMeasurementGrid: Convenience wrapper for wall grids (vertical)
 */
interface WallGridProps {
  wallWidth: number
  wallHeight: number
  settings: SurfaceGridSettings
  wallPosition: [number, number, number]
  wallRotation: [number, number, number]
}

export function WallMeasurementGrid({
  wallWidth,
  wallHeight,
  settings,
  wallPosition,
  wallRotation,
}: WallGridProps) {
  if (!settings.enabled) return null

  return (
    <MeasurementGrid
      width={wallWidth}
      height={wallHeight}
      settings={settings}
      position={wallPosition}
      rotation={wallRotation}
    />
  )
}
