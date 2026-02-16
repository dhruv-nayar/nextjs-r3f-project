'use client'

import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useResizeMode } from '@/lib/resize-mode-context'

interface ResizeHandlesProps {
  dimensions: { width: number; height: number; depth: number }
  position: { x: number; y: number; z: number }
  onDimensionChange: (dimension: 'width' | 'height' | 'depth', newValue: number) => void
}

interface HandleProps {
  axis: 'x' | 'y' | 'z'
  direction: 1 | -1
  dimension: 'width' | 'height' | 'depth'
  position: [number, number, number]
  color: string
  onDrag: (delta: number) => void
}

function Handle({ axis, direction, dimension, position, color, onDrag }: HandleProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ point: THREE.Vector3; value: number } | null>(null)
  const { setActiveAxis } = useResizeMode()
  const { camera, gl } = useThree()

  // Handle visual feedback
  useFrame(() => {
    if (meshRef.current) {
      const scale = isHovered || isDragging ? 1.3 : 1
      meshRef.current.scale.setScalar(scale)
    }
  })

  const handlePointerDown = (e: THREE.Event & { stopPropagation: () => void; point: THREE.Vector3 }) => {
    e.stopPropagation()
    setIsDragging(true)
    setActiveAxis(axis)
    dragStart.current = {
      point: e.point.clone(),
      value: 0
    }
    // Capture pointer to track movement outside the mesh
    ;(e.target as HTMLElement)?.setPointerCapture?.((e as unknown as PointerEvent).pointerId)
    gl.domElement.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e: THREE.Event & { point: THREE.Vector3 }) => {
    if (!isDragging || !dragStart.current) return

    // Calculate movement along the axis
    const currentPoint = e.point.clone()
    const delta = currentPoint[axis] - dragStart.current.point[axis]

    // Apply the delta in the direction of the handle
    // Dragging the +X handle outward increases width
    // Dragging the -X handle outward also increases width (both expand from center)
    const dimensionDelta = delta * direction

    if (Math.abs(dimensionDelta) > 0.01) {
      onDrag(dimensionDelta)
      dragStart.current.point = currentPoint
    }
  }

  const handlePointerUp = (e: THREE.Event) => {
    setIsDragging(false)
    setActiveAxis(null)
    dragStart.current = null
    ;(e.target as HTMLElement)?.releasePointerCapture?.((e as unknown as PointerEvent).pointerId)
    gl.domElement.style.cursor = 'auto'
  }

  // Get color based on axis
  const axisColors: Record<string, string> = {
    x: '#ef4444', // red
    y: '#22c55e', // green
    z: '#3b82f6', // blue
  }

  const baseColor = axisColors[axis]
  const displayColor = isHovered || isDragging ? '#ffffff' : baseColor

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setIsHovered(true)
        gl.domElement.style.cursor = 'grab'
      }}
      onPointerOut={(e) => {
        setIsHovered(false)
        if (!isDragging) {
          gl.domElement.style.cursor = 'auto'
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial
        color={displayColor}
        emissive={displayColor}
        emissiveIntensity={isHovered || isDragging ? 0.5 : 0.2}
      />
    </mesh>
  )
}

export function ResizeHandles({ dimensions, position, onDimensionChange }: ResizeHandlesProps) {
  const { activeAxis } = useResizeMode()

  // Calculate handle positions based on dimensions
  // Handles are placed at the center of each face
  const halfWidth = dimensions.width / 2
  const halfHeight = dimensions.height / 2
  const halfDepth = dimensions.depth / 2

  const handles: {
    axis: 'x' | 'y' | 'z'
    direction: 1 | -1
    dimension: 'width' | 'height' | 'depth'
    position: [number, number, number]
  }[] = [
    // X axis (width) - left and right
    { axis: 'x', direction: 1, dimension: 'width', position: [halfWidth, halfHeight, 0] },
    { axis: 'x', direction: -1, dimension: 'width', position: [-halfWidth, halfHeight, 0] },
    // Y axis (height) - top only (bottom is usually on floor)
    { axis: 'y', direction: 1, dimension: 'height', position: [0, dimensions.height, 0] },
    // Z axis (depth) - front and back
    { axis: 'z', direction: 1, dimension: 'depth', position: [0, halfHeight, halfDepth] },
    { axis: 'z', direction: -1, dimension: 'depth', position: [0, halfHeight, -halfDepth] },
  ]

  const handleDrag = (dimension: 'width' | 'height' | 'depth', delta: number) => {
    const currentValue = dimensions[dimension]
    // Multiply by 2 since we're expanding from center (both sides grow)
    const newValue = Math.max(0.1, currentValue + delta * 2)
    onDimensionChange(dimension, newValue)
  }

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Bounding box outline */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth)]} />
        <lineBasicMaterial color="#f97316" linewidth={2} transparent opacity={0.5} />
      </lineSegments>

      {/* Render handles */}
      {handles.map((handle, index) => (
        <Handle
          key={`${handle.axis}-${handle.direction}`}
          axis={handle.axis}
          direction={handle.direction}
          dimension={handle.dimension}
          position={handle.position}
          color={activeAxis === handle.axis ? '#ffffff' : '#f97316'}
          onDrag={(delta) => handleDrag(handle.dimension, delta)}
        />
      ))}

      {/* Axis lines for visual reference */}
      {activeAxis && (
        <group>
          {activeAxis === 'x' && (
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([-2, halfHeight, 0, 2, halfHeight, 0]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#ef4444" linewidth={2} />
            </line>
          )}
          {activeAxis === 'y' && (
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([0, 0, 0, 0, dimensions.height + 1, 0]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#22c55e" linewidth={2} />
            </line>
          )}
          {activeAxis === 'z' && (
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([0, halfHeight, -2, 0, halfHeight, 2]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#3b82f6" linewidth={2} />
            </line>
          )}
        </group>
      )}
    </group>
  )
}
