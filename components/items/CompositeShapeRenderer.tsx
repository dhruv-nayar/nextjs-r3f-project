'use client'

import { useMemo } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { CompositeShape, CompositeShapePart, ExtrusionFaceId, Vector3 } from '@/types/room'
import { ExtrusionShapeV2Renderer, calculateExtrusionV2Dimensions } from './ExtrusionShapeV2Renderer'

interface CompositeShapeRendererProps {
  shape: CompositeShape
  position?: Vector3
  rotation?: Vector3
  scale?: Vector3
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
  onPartClick?: (partId: string, faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => void
  onPartHover?: (partId: string | null, faceId: ExtrusionFaceId | null) => void
  selectedPartId?: string | null
  highlightedFace?: { partId: string; faceId: ExtrusionFaceId } | null
}

/**
 * Renders a single part within the composite
 */
function CompositePartRenderer({
  part,
  castShadow,
  receiveShadow,
  onPartClick,
  onPartHover,
  isSelected,
  highlightedFace,
}: {
  part: CompositeShapePart
  castShadow?: boolean
  receiveShadow?: boolean
  onPartClick?: (partId: string, faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => void
  onPartHover?: (partId: string | null, faceId: ExtrusionFaceId | null) => void
  isSelected?: boolean
  highlightedFace?: ExtrusionFaceId | null
}) {
  if (!part.visible) {
    return null
  }

  const handleFaceClick = (faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => {
    if (!part.locked) {
      onPartClick?.(part.id, faceId, event)
    }
  }

  const handleFaceHover = (faceId: ExtrusionFaceId | null) => {
    if (!part.locked) {
      onPartHover?.(faceId ? part.id : null, faceId)
    }
  }

  return (
    <group
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={[part.rotation.x, part.rotation.y, part.rotation.z]}
    >
      <ExtrusionShapeV2Renderer
        shape={part.shape}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onFaceClick={handleFaceClick}
        onFaceHover={handleFaceHover}
        highlightedFace={highlightedFace}
        userData={{ partId: part.id, partName: part.name, locked: part.locked }}
      />
    </group>
  )
}

/**
 * Renders a CompositeShape with multiple positioned parts
 *
 * Features:
 * - Renders each part at its specified position/rotation
 * - Respects part visibility and locked states
 * - Supports per-part and per-face click/hover events
 * - Parts can be highlighted/selected for editing
 */
export function CompositeShapeRenderer({
  shape,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut,
  onPartClick,
  onPartHover,
  selectedPartId,
  highlightedFace,
}: CompositeShapeRendererProps) {
  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {shape.parts.map((part) => (
        <CompositePartRenderer
          key={part.id}
          part={part}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onPartClick={onPartClick}
          onPartHover={onPartHover}
          isSelected={part.id === selectedPartId}
          highlightedFace={
            highlightedFace?.partId === part.id ? highlightedFace.faceId : null
          }
        />
      ))}
    </group>
  )
}

/**
 * Calculate the bounding dimensions of a CompositeShape
 * Returns the bounding box that encompasses all parts
 */
export function calculateCompositeDimensions(shape: CompositeShape): {
  width: number
  height: number
  depth: number
} {
  if (!shape.parts || shape.parts.length === 0) {
    return { width: 1, height: 1, depth: 1 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const part of shape.parts) {
    if (!part.visible) continue

    // Calculate the dimensions of this part's shape
    const partDims = calculateExtrusionV2Dimensions(part.shape)

    // Account for the part's position (center of the shape)
    // The shape is centered, so offset by half the dimensions
    const partMinX = part.position.x - partDims.width / 2
    const partMaxX = part.position.x + partDims.width / 2
    const partMinY = part.position.y
    const partMaxY = part.position.y + partDims.height
    const partMinZ = part.position.z - partDims.depth / 2
    const partMaxZ = part.position.z + partDims.depth / 2

    // Update global bounds
    minX = Math.min(minX, partMinX)
    maxX = Math.max(maxX, partMaxX)
    minY = Math.min(minY, partMinY)
    maxY = Math.max(maxY, partMaxY)
    minZ = Math.min(minZ, partMinZ)
    maxZ = Math.max(maxZ, partMaxZ)
  }

  // Handle case where all parts are hidden
  if (minX === Infinity) {
    return { width: 1, height: 1, depth: 1 }
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
  }
}

/**
 * Helper to create a new CompositeShapePart with default values
 */
export function createCompositeShapePart(
  shape: CompositeShapePart['shape'],
  name: string,
  position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
): CompositeShapePart {
  return {
    id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    shape,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    locked: false,
    visible: true,
  }
}

/**
 * Helper to update a part's position in a CompositeShape
 */
export function updatePartPosition(
  shape: CompositeShape,
  partId: string,
  position: Partial<{ x: number; y: number; z: number }>
): CompositeShape {
  return {
    ...shape,
    parts: shape.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            position: {
              ...part.position,
              ...position,
            },
          }
        : part
    ),
  }
}

/**
 * Helper to update a part's rotation in a CompositeShape
 */
export function updatePartRotation(
  shape: CompositeShape,
  partId: string,
  rotation: Partial<{ x: number; y: number; z: number }>
): CompositeShape {
  return {
    ...shape,
    parts: shape.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            rotation: {
              ...part.rotation,
              ...rotation,
            },
          }
        : part
    ),
  }
}

/**
 * Helper to toggle a part's locked state
 */
export function togglePartLocked(shape: CompositeShape, partId: string): CompositeShape {
  return {
    ...shape,
    parts: shape.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            locked: !part.locked,
          }
        : part
    ),
  }
}

/**
 * Helper to toggle a part's visibility
 */
export function togglePartVisibility(shape: CompositeShape, partId: string): CompositeShape {
  return {
    ...shape,
    parts: shape.parts.map((part) =>
      part.id === partId
        ? {
            ...part,
            visible: !part.visible,
          }
        : part
    ),
  }
}

/**
 * Helper to remove a part from a CompositeShape
 */
export function removePart(shape: CompositeShape, partId: string): CompositeShape {
  return {
    ...shape,
    parts: shape.parts.filter((part) => part.id !== partId),
  }
}

/**
 * Helper to add a part to a CompositeShape
 */
export function addPart(shape: CompositeShape, part: CompositeShapePart): CompositeShape {
  return {
    ...shape,
    parts: [...shape.parts, part],
  }
}
