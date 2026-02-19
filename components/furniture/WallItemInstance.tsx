'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { Item, ItemInstance, WallPlacement } from '@/types/room'
import { ParametricShapeRenderer, calculateShapeDimensions } from '@/components/items/ParametricShapeRenderer'
import { useFurnitureHover } from '@/lib/furniture-hover-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useSelection } from '@/lib/selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { useWallMesh } from '@/lib/contexts/wall-mesh-context'
import {
  wallRelativeToWorld,
  worldToWallRelative,
  getWallFacingRotation,
  getWallPlane,
  constrainToWallBounds,
  detectWallEdge
} from '@/lib/utils/wall-coordinates'
import * as THREE from 'three'
import { useThree, ThreeEvent } from '@react-three/fiber'

// Drag threshold in world units - prevents accidental micro-drags
const DRAG_THRESHOLD = 0.1

// Helper to get accurate NDC from pointer events
function getNDC(e: PointerEvent | MouseEvent, canvas: HTMLCanvasElement): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect()
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
}

interface WallItemInstanceProps {
  instance: ItemInstance
  item: Item
}

/**
 * WallItemInstance: Renders and handles interaction for wall-mounted items
 * Uses wall-relative coordinates for positioning with drag support along wall plane
 */
export function WallItemInstance({ instance, item }: WallItemInstanceProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { selectFurniture, isFurnitureSelected, hoveredItem, setHoveredItem } = useSelection()
  const { updateInstance } = useRoom()
  const { mode, setMode } = useInteractionMode()
  const { camera, gl } = useThree()
  const { getWallMesh, getAllWallMeshes } = useWallMesh()

  // Selection and hover state
  const isHovered = hoveredFurnitureId === instance.id ||
    (hoveredItem?.type === 'furniture' && hoveredItem.instanceId === instance.id)
  const isSelected = selectedFurnitureId === instance.id || isFurnitureSelected(instance.id)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [isVisuallyDragging, setIsVisuallyDragging] = useState(false)
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null)
  const currentWallPlacementRef = useRef<WallPlacement | null>(null)
  const currentWallMeshRef = useRef<THREE.Mesh | null>(null)

  // Get wall placement or default
  const wallPlacement = instance.wallPlacement || {
    roomId: instance.roomId,
    wallSide: 'north' as const,
    heightFromFloor: item.dimensions.height / 2 + 3, // Default 3ft above floor + half item height
    lateralOffset: 0,
    normalOffset: item.dimensions.depth / 2
  }

  // Get the wall mesh for this instance
  const wallMesh = getWallMesh(wallPlacement.roomId, wallPlacement.wallSide)

  // Calculate position and rotation
  // For V3 walls (TwoSidedWallSegment), instance.position is already room-local
  // and instance.rotation contains the correct wall-facing rotation
  const worldPosition = useMemo(() => {
    // If wall mesh found, try to compute from wall placement
    // Otherwise use instance position directly (stored during placement)
    if (wallMesh && wallMesh.userData.surfaceType === 'wall') {
      // For V3 walls, the instance position is already correct (room-local)
      // Just use it directly
      return instance.position
    }
    // For V2 walls, try wallRelativeToWorld (may not work perfectly)
    if (wallMesh) {
      try {
        return wallRelativeToWorld(wallPlacement, wallMesh)
      } catch {
        return instance.position
      }
    }
    return instance.position
  }, [wallPlacement, wallMesh, instance.position])

  // Calculate rotation to face outward from wall
  // For V3 walls: use instance.rotation.y directly (set during placement from wall normal)
  // For V2 walls: compute from wallSide if instance rotation is 0
  const wallRotationY = instance.rotation.y !== 0 ? 0 : getWallFacingRotation(wallPlacement.wallSide)

  // Get item dimensions for constraint calculations
  const itemDimensions = useMemo(() => {
    if (item.parametricShape) {
      return calculateShapeDimensions(item.parametricShape)
    }
    return item.dimensions
  }, [item])

  // Apply highlight effect when hovered or selected
  useEffect(() => {
    if (!groupRef.current) return

    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isHovered || isSelected) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material
          }
          const highlightMaterial = child.material.clone()
          if (highlightMaterial instanceof THREE.MeshStandardMaterial) {
            const color = isSelected ? 0xffa500 : 0x00ffff
            highlightMaterial.emissive = new THREE.Color(color)
            highlightMaterial.emissiveIntensity = isVisuallyDragging ? 1.2 : (isSelected ? 0.5 : 0.3)
          }
          child.material = highlightMaterial
        } else if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial
        }
      }
    })
  }, [isHovered, isSelected, isVisuallyDragging])

  // Handle arrow key movement when selected (wall-relative)
  useEffect(() => {
    if (!isSelected || !wallMesh) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveSpeed = 0.25 // 0.25 feet per key press

      let newLateral = wallPlacement.lateralOffset
      let newHeight = wallPlacement.heightFromFloor

      switch (e.key) {
        case 'ArrowUp':
          newHeight += moveSpeed
          e.preventDefault()
          break
        case 'ArrowDown':
          newHeight -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowLeft':
          newLateral -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowRight':
          newLateral += moveSpeed
          e.preventDefault()
          break
        default:
          return
      }

      // Constrain to wall bounds
      const constrained = constrainToWallBounds(
        { ...wallPlacement, lateralOffset: newLateral, heightFromFloor: newHeight },
        wallMesh,
        itemDimensions.width,
        itemDimensions.height
      )

      updateInstance(instance.id, {
        wallPlacement: {
          ...wallPlacement,
          lateralOffset: constrained.lateralOffset,
          heightFromFloor: constrained.heightFromFloor
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, instance.id, wallPlacement, updateInstance, wallMesh, itemDimensions])

  // Global pointerup listener to prevent stuck drag state
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalPointerUp = () => {
      if (currentWallPlacementRef.current) {
        updateInstance(instance.id, {
          wallPlacement: currentWallPlacementRef.current
        })
      }
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      currentWallPlacementRef.current = null
      currentWallMeshRef.current = null
      setMode('idle')
      document.body.style.cursor = 'default'
    }

    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [isDragging, setMode, instance.id, updateInstance])

  // Handle drag start
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    if (mode === 'camera' || !wallMesh) return

    // Select the item
    setSelectedFurnitureId(instance.id)
    selectFurniture(instance.id, instance.roomId)

    // Get the wall plane for raycasting
    const wallPlaneGeom = getWallPlane(wallMesh)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)

    const clickOnPlane = new THREE.Vector3()
    raycaster.ray.intersectPlane(wallPlaneGeom, clickOnPlane)

    // Start drag
    setIsDragging(true)
    setIsVisuallyDragging(false)
    dragStartPosRef.current = clickOnPlane.clone()
    currentWallMeshRef.current = wallMesh
    currentWallPlacementRef.current = { ...wallPlacement }
    setMode('dragging')
    document.body.style.cursor = 'grab'
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    if (isDragging) {
      if (currentWallPlacementRef.current) {
        updateInstance(instance.id, {
          wallPlacement: currentWallPlacementRef.current
        })
      }
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      currentWallPlacementRef.current = null
      currentWallMeshRef.current = null
      setMode('idle')
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStartPosRef.current || !currentWallMeshRef.current) return

    e.stopPropagation()

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)

    // First, try to hit any wall
    const allWalls = getAllWallMeshes()
    const intersects = raycaster.intersectObjects(allWalls, false)

    let targetWallMesh = currentWallMeshRef.current
    let hitPoint: THREE.Vector3 | null = null

    if (intersects.length > 0) {
      const hit = intersects[0]
      targetWallMesh = hit.object as THREE.Mesh
      hitPoint = hit.point
    } else {
      // Fallback: intersect with current wall plane
      const wallPlaneGeom = getWallPlane(currentWallMeshRef.current)
      hitPoint = new THREE.Vector3()
      raycaster.ray.intersectPlane(wallPlaneGeom, hitPoint)
    }

    if (!hitPoint) return

    // Check threshold for visual dragging
    if (!isVisuallyDragging) {
      const distance = hitPoint.distanceTo(dragStartPosRef.current)
      if (distance < DRAG_THRESHOLD) return
      setIsVisuallyDragging(true)
      document.body.style.cursor = 'grabbing'
    }

    // Convert hit point to wall-relative coordinates
    const newWallRelative = worldToWallRelative(hitPoint, targetWallMesh)
    const targetWallSide = targetWallMesh.userData.wallSide

    // Check if we're switching walls
    if (targetWallSide !== currentWallPlacementRef.current?.wallSide) {
      currentWallMeshRef.current = targetWallMesh
    }

    // Constrain to wall bounds
    const constrained = constrainToWallBounds(
      { ...newWallRelative, roomId: wallPlacement.roomId },
      targetWallMesh,
      itemDimensions.width,
      itemDimensions.height
    )

    // Update the current placement ref (visual update via groupRef)
    currentWallPlacementRef.current = {
      roomId: wallPlacement.roomId,
      wallSide: targetWallSide,
      heightFromFloor: constrained.heightFromFloor,
      lateralOffset: constrained.lateralOffset,
      normalOffset: itemDimensions.depth / 2
    }

    // Update visual position directly
    if (groupRef.current) {
      const newWorldPos = wallRelativeToWorld(currentWallPlacementRef.current, targetWallMesh)
      groupRef.current.position.set(newWorldPos.x, newWorldPos.y, newWorldPos.z)
      // Update rotation if wall changed
      const newRotY = getWallFacingRotation(targetWallSide)
      groupRef.current.rotation.y = newRotY
    }
  }

  // Calculate bounding box for outline
  const outlineSize = useMemo(() => {
    return new THREE.Vector3(itemDimensions.width, itemDimensions.height, itemDimensions.depth)
  }, [itemDimensions])

  return (
    <group
      ref={groupRef}
      position={[worldPosition.x, worldPosition.y, worldPosition.z]}
      rotation={[instance.rotation.x, wallRotationY + (instance.rotation.y || 0), instance.rotation.z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHoveredFurnitureId(instance.id)
        setHoveredItem({ type: 'furniture', instanceId: instance.id, roomId: instance.roomId })
        if (isVisuallyDragging) {
          document.body.style.cursor = 'grabbing'
        } else if (isSelected) {
          document.body.style.cursor = 'grab'
        } else {
          document.body.style.cursor = 'pointer'
        }
      }}
      onPointerOut={() => {
        setHoveredFurnitureId(null)
        setHoveredItem(null)
        if (!isVisuallyDragging) {
          document.body.style.cursor = 'default'
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Render content based on item type */}
      {item.parametricShape ? (
        <ParametricShapeRenderer
          shape={item.parametricShape}
          position={{ x: 0, y: 0, z: 0 }}
          castShadow
          receiveShadow
        />
      ) : item.modelPath ? (
        <Suspense fallback={<WallItemPlaceholder dimensions={itemDimensions} />}>
          <WallItemGLBModel item={item} />
        </Suspense>
      ) : (
        <WallItemPlaceholder dimensions={itemDimensions} />
      )}

      {/* Outline when hovered or selected */}
      {(isHovered || isSelected) && (
        <>
          <mesh position={[0, 0, 0]} raycast={() => null}>
            <boxGeometry args={[outlineSize.x * 1.05, outlineSize.y * 1.05, outlineSize.z * 1.05]} />
            <meshBasicMaterial
              color={isSelected ? "#ffa500" : "#00ffff"}
              wireframe
              transparent
              opacity={0.6}
            />
          </mesh>
          <lineSegments position={[0, 0, 0]} raycast={() => null}>
            <edgesGeometry args={[new THREE.BoxGeometry(outlineSize.x * 1.03, outlineSize.y * 1.03, outlineSize.z * 1.03)]} />
            <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
          </lineSegments>
        </>
      )}
    </group>
  )
}

/**
 * Placeholder mesh for loading state
 */
function WallItemPlaceholder({ dimensions }: { dimensions: { width: number; height: number; depth: number } }) {
  return (
    <mesh>
      <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
      <meshStandardMaterial color="#888888" opacity={0.5} transparent />
    </mesh>
  )
}

/**
 * GLB model loader for wall items
 */
function WallItemGLBModel({ item }: { item: Item }) {
  const { scene } = useGLTF(item.modelPath!)

  const { clonedScene, autoScale } = useMemo(() => {
    const cloned = scene.clone()
    const box = new THREE.Box3().setFromObject(cloned)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // Center the model
    cloned.position.set(-center.x, -center.y, -center.z)

    const scale = {
      x: item.dimensions.width / size.x,
      y: item.dimensions.height / size.y,
      z: item.dimensions.depth / size.z
    }

    return { clonedScene: cloned, autoScale: scale }
  }, [scene, item.dimensions])

  return (
    <group scale={[autoScale.x, autoScale.y, autoScale.z]}>
      <primitive object={clonedScene} castShadow receiveShadow />
    </group>
  )
}
