'use client'

import { Suspense, useEffect, useMemo, useRef, useState, Component, ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { FurnitureItem, Item, ItemInstance, ParametricShape } from '@/types/room'

// Error boundary for catching GLB loading failures
class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('[FurnitureLibrary] Model loading failed:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
import { ParametricShapeRenderer, calculateShapeDimensions } from '@/components/items/ParametricShapeRenderer'
import { useFurnitureHover } from '@/lib/furniture-hover-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useSelection } from '@/lib/selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { useResizeMode } from '@/lib/resize-mode-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { ResizeHandles } from './ResizeHandles'
import { WallItemInstance } from './WallItemInstance'
import * as THREE from 'three'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'

// Drag threshold in world units - prevents accidental micro-drags
const DRAG_THRESHOLD = 0.1

// Helper to get accurate normalized device coordinates from pointer events
// Uses getBoundingClientRect for accuracy with CSS scaling
function getNDC(e: PointerEvent | MouseEvent, canvas: HTMLCanvasElement): THREE.Vector2 {
  const rect = canvas.getBoundingClientRect()
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  )
}

interface FurnitureProps {
  item: FurnitureItem
}

function FurnitureModel({ item }: FurnitureProps) {
  const { scene } = useGLTF(item.modelPath)
  const clonedScene = scene.clone()
  const groupRef = useRef<THREE.Group>(null)
  const outlineRef = useRef<THREE.LineSegments>(null)
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { updateFurniture } = useRoom()
  const { camera, gl } = useThree()
  const isHovered = hoveredFurnitureId === item.id
  const isSelected = selectedFurnitureId === item.id
  const [isDragging, setIsDragging] = useState(false)
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Calculate the model's original bounding box
  const box = new THREE.Box3().setFromObject(clonedScene)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  // Calculate auto-scale based on targetDimensions if provided
  let autoScale = { x: 1, y: 1, z: 1 }
  if (item.targetDimensions) {
    // Calculate scale factors to match target dimensions (in feet)
    // size is in model units, we want to scale to match target feet
    autoScale = {
      x: item.targetDimensions.width / size.x,
      y: item.targetDimensions.height / size.y,
      z: item.targetDimensions.depth / size.z
    }
  }

  // Center X and Z, but place bottom at Y=0 (before any scaling)
  clonedScene.position.set(-center.x, -box.min.y, -center.z)

  // Apply highlight effect when hovered or selected
  useEffect(() => {
    if (!groupRef.current) return

    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (isHovered || isSelected) {
          // Store original material if not already stored
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material
          }
          // Create highlighted material with strong glow
          const highlightMaterial = child.material.clone()
          if (highlightMaterial instanceof THREE.MeshStandardMaterial) {
            // Use different colors for hover vs selected
            highlightMaterial.emissive = new THREE.Color(isSelected ? 0xffa500 : 0x00ffff)  // Orange for selected, cyan for hover
            highlightMaterial.emissiveIntensity = 0.8
          }
          child.material = highlightMaterial
        } else if (child.userData.originalMaterial) {
          // Restore original material
          child.material = child.userData.originalMaterial
        }
      }
    })
  }, [isHovered, isSelected])

  // Handle arrow key movement when selected
  useEffect(() => {
    if (!isSelected) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const moveSpeed = 0.5  // 0.5 feet per key press
      let newX = item.position.x
      let newZ = item.position.z

      switch (e.key) {
        case 'ArrowUp':
          newZ -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowDown':
          newZ += moveSpeed
          e.preventDefault()
          break
        case 'ArrowLeft':
          newX -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowRight':
          newX += moveSpeed
          e.preventDefault()
          break
        default:
          return
      }

      updateFurniture(item.id, {
        position: { ...item.position, x: newX, z: newZ }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, item.id, item.position, updateFurniture])

  // Handle drag movement
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isSelected) {
      e.stopPropagation()
      setSelectedFurnitureId(item.id)
    } else {
      e.stopPropagation()
      setIsDragging(true)
      document.body.style.cursor = 'grabbing'
    }
  }

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging) return

    e.stopPropagation()
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)

    const intersectionPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersectionPoint)

    if (intersectionPoint) {
      updateFurniture(item.id, {
        position: { ...item.position, x: intersectionPoint.x, z: intersectionPoint.z }
      })
    }
  }

  return (
    <group
      ref={groupRef}
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[item.rotation.x, item.rotation.y, item.rotation.z]}
      scale={[
        item.scale.x * autoScale.x,
        item.scale.y * autoScale.y,
        item.scale.z * autoScale.z
      ]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHoveredFurnitureId(item.id)
        document.body.style.cursor = isDragging ? 'grabbing' : 'pointer'
      }}
      onPointerOut={() => {
        setHoveredFurnitureId(null)
        if (!isDragging) {
          document.body.style.cursor = 'default'
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onClick={(e) => e.stopPropagation()} // Prevent floor click from firing
    >
      <primitive object={clonedScene} castShadow receiveShadow />

      {/* Outline border when hovered or selected - using multiple layers */}
      {/* raycast={() => null} prevents these visual elements from intercepting clicks */}
      {(isHovered || isSelected) && (
        <>
          {/* Outer glow box */}
          <mesh position={[0, size.y / 2, 0]} raycast={() => null}>
            <boxGeometry args={[size.x * 1.05, size.y * 1.05, size.z * 1.05]} />
            <meshBasicMaterial
              color={isSelected ? "#ffa500" : "#00ffff"}
              wireframe
              transparent
              opacity={0.6}
            />
          </mesh>
          {/* Middle outline */}
          <lineSegments position={[0, size.y / 2, 0]} raycast={() => null}>
            <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.03, size.y * 1.03, size.z * 1.03)]} />
            <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
          </lineSegments>
          {/* Inner outline */}
          <lineSegments position={[0, size.y / 2, 0]} raycast={() => null}>
            <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.01, size.y * 1.01, size.z * 1.01)]} />
            <lineBasicMaterial color="#ffffff" />
          </lineSegments>
        </>
      )}
    </group>
  )
}

export function Furniture({ item }: FurnitureProps) {
  return (
    <Suspense fallback={<PlaceholderFurniture item={item} />}>
      <FurnitureModel item={item} />
    </Suspense>
  )
}

function PlaceholderFurniture({ item }: FurnitureProps) {
  return (
    <mesh
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[item.rotation.x, item.rotation.y, item.rotation.z]}
      scale={[item.scale.x, item.scale.y, item.scale.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={getCategoryColor(item.category)} />
    </mesh>
  )
}

function getCategoryColor(category?: string): string {
  switch (category) {
    case 'seating':
      return '#8B4513' // Brown
    case 'table':
      return '#D2691E' // Chocolate
    case 'storage':
      return '#2F4F4F' // Dark slate gray
    case 'bed':
      return '#4169E1' // Royal blue
    case 'decoration':
      return '#FF69B4' // Hot pink
    case 'lighting':
      return '#FFD700' // Gold
    default:
      return '#808080' // Gray
  }
}

// Furniture catalog with free model sources
export const FURNITURE_CATALOG = {
  // Sample furniture items
  chair: {
    name: 'Chair',
    modelPath: '/models/chair.glb',
    category: 'seating' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  table: {
    name: 'Table',
    modelPath: '/models/table.glb',
    category: 'table' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  sofa: {
    name: 'Sofa',
    modelPath: '/models/sofa.glb',
    category: 'seating' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  bed: {
    name: 'Bed',
    modelPath: '/models/bed.glb',
    category: 'bed' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  desk: {
    name: 'Desk',
    modelPath: '/models/desk.glb',
    category: 'table' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  bookshelf: {
    name: 'Bookshelf',
    modelPath: '/models/bookshelf.glb',
    category: 'storage' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  lamp: {
    name: 'Lamp',
    modelPath: '/models/lamp.glb',
    category: 'lighting' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  },
  plant: {
    name: 'Plant',
    modelPath: '/models/plant.glb',
    category: 'decoration' as const,
    defaultScale: { x: 1, y: 1, z: 1 }
  }
}

export type FurnitureCatalogKey = keyof typeof FURNITURE_CATALOG

// ============================================
// NEW: Item Instance Renderer
// ============================================

interface ItemInstanceProps {
  instance: ItemInstance
  item: Item
}

/**
 * Renders an ItemInstance by combining instance transform data
 * with item model/dimension data from the library
 */
function ItemInstanceModel({ instance, item }: ItemInstanceProps) {
  const { scene } = useGLTF(item.modelPath!)
  const groupRef = useRef<THREE.Group>(null)
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  // Use both old and new selection context during migration
  const {
    selectedInstanceIds,
    selectInstance,
    toggleInstanceSelection,
    isInstanceSelected,
    clearInstanceSelection,
    multiDragState,
    startMultiDrag,
    updateMultiDragDelta,
    endMultiDrag,
    getMultiDragPosition
  } = useFurnitureSelection()
  const { selectFurniture, isFurnitureSelected, hoveredItem, setHoveredItem, clearSelection } = useSelection()
  const { updateInstance, currentRoom } = useRoom()
  const { updateItem } = useItemLibrary()
  const { isResizeMode, setResizeMode } = useResizeMode()
  const { mode, setMode } = useInteractionMode()
  const { camera, gl } = useThree()
  // Check both old hover context and new selection context hover
  const isHovered = hoveredFurnitureId === instance.id ||
    (hoveredItem?.type === 'furniture' && hoveredItem.instanceId === instance.id)
  // Check multi-select state
  const isSelected = isInstanceSelected(instance.id) || isFurnitureSelected(instance.id)
  const [isDragging, setIsDragging] = useState(false)
  const [isVisuallyDragging, setIsVisuallyDragging] = useState(false)
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null)
  const dragOffsetRef = useRef<THREE.Vector2 | null>(null) // Offset from cursor to object center
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragPositionRef = useRef<{ x: number; z: number } | null>(null) // Current drag position for direct updates

  // Memoize the cloned scene and its transformations to prevent position drift
  const { clonedScene, size, center, autoScale, yOffset } = useMemo(() => {
    const cloned = scene.clone()

    // Get the original (un-rotated) bounding box
    const box = new THREE.Box3().setFromObject(cloned)
    const centerVec = box.getCenter(new THREE.Vector3())
    const sizeVec = box.getSize(new THREE.Vector3())

    // The item's defaultRotation affects how the user views the model in the item editor
    // When they set dimensions, they're relative to that rotated view
    // We need to transform the dimensions to match the original model axes
    const defaultRotX = item.defaultRotation?.x || 0
    const defaultRotZ = item.defaultRotation?.z || 0

    // Create dimension vector and apply INVERSE rotation to map from viewed dimensions to original axes
    // User sets: width=viewedX, height=viewedY, depth=viewedZ
    // We need to find: what original axis each viewed axis corresponds to
    const dimVec = new THREE.Vector3(item.dimensions.width, item.dimensions.height, item.dimensions.depth)

    if (defaultRotX !== 0 || defaultRotZ !== 0) {
      // Create inverse rotation matrix
      const euler = new THREE.Euler(-defaultRotX, 0, -defaultRotZ, 'ZYX') // Inverse rotation, reverse order
      const rotMatrix = new THREE.Matrix4().makeRotationFromEuler(euler)

      // Apply inverse rotation to dimensions to get them in original model space
      dimVec.applyMatrix4(rotMatrix)

      // Take absolute values since dimensions should be positive
      dimVec.set(Math.abs(dimVec.x), Math.abs(dimVec.y), Math.abs(dimVec.z))
    }

    // Calculate auto-scale based on transformed dimensions
    const scale = {
      x: dimVec.x / sizeVec.x,
      y: dimVec.y / sizeVec.y,
      z: dimVec.z / sizeVec.z
    }

    // Center X and Z only - Y offset will be applied outside the scaled group
    // to ensure the bottom is at Y=0 regardless of scaling
    cloned.position.set(-centerVec.x, 0, -centerVec.z)

    // Calculate the Y offset needed to place bottom at Y=0 AFTER scaling
    // The scaled bottom position is: box.min.y * scale.y
    // We need to offset by the negative of this
    const bottomOffset = -box.min.y * scale.y

    return { clonedScene: cloned, size: sizeVec, center: centerVec, autoScale: scale, yOffset: bottomOffset }
  }, [scene, item.dimensions.width, item.dimensions.height, item.dimensions.depth, item.defaultRotation?.x, item.defaultRotation?.z])

  // After positioning: model is centered at X=0, Z=0, with bottom at Y=0
  // Bounding box center is at (0, size.y/2, 0) in local space

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
            // Orange when selected, cyan when just hovered
            const color = isSelected ? 0xffa500 : 0x00ffff
            highlightMaterial.emissive = new THREE.Color(color)
            // Higher intensity when actively dragging
            highlightMaterial.emissiveIntensity = isVisuallyDragging ? 1.2 : (isSelected ? 0.5 : 0.3)
          }
          child.material = highlightMaterial
        } else if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial
        }
      }
    })
  }, [isHovered, isSelected, isVisuallyDragging])

  // Handle arrow key movement and resize mode toggle when selected
  useEffect(() => {
    if (!isSelected) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle resize mode with 'R' key
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setResizeMode(!isResizeMode)
        return
      }

      // Disable movement in resize mode
      if (isResizeMode) return

      const moveSpeed = 0.5
      let newX = instance.position.x
      let newZ = instance.position.z

      switch (e.key) {
        case 'ArrowUp':
          newZ -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowDown':
          newZ += moveSpeed
          e.preventDefault()
          break
        case 'ArrowLeft':
          newX -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowRight':
          newX += moveSpeed
          e.preventDefault()
          break
        default:
          return
      }

      updateInstance(instance.id, {
        position: { ...instance.position, x: newX, z: newZ }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, instance.id, instance.position, updateInstance, isResizeMode, setResizeMode])

  // Global pointerup listener to prevent stuck drag state when releasing outside the object
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalPointerUp = () => {
      // Check if this is the anchor of a multi-drag
      if (multiDragState && multiDragState.anchorId === instance.id) {
        // End multi-drag and get final positions for all items
        const finalPositions = endMultiDrag()
        if (finalPositions) {
          // Update all items' positions
          finalPositions.forEach((pos, instanceId) => {
            updateInstance(instanceId, {
              position: { x: pos.x, y: 0, z: pos.z }
            })
          })
        }
      } else if (dragPositionRef.current) {
        // Single item drag - commit final position
        updateInstance(instance.id, {
          position: {
            ...instance.position,
            x: dragPositionRef.current.x,
            z: dragPositionRef.current.z
          }
        })
      }

      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      dragPositionRef.current = null
      setMode('idle')
      document.body.style.cursor = 'default'
    }

    // Use window to catch pointerup anywhere
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [isDragging, setMode, instance.id, instance.position, updateInstance, multiDragState, endMultiDrag])

  // Follow multi-drag delta for non-anchor selected items
  // This runs every frame to smoothly update position during multi-drag
  useFrame(() => {
    if (!groupRef.current) return
    if (!multiDragState) return
    // Skip if this is the anchor (it handles its own movement)
    if (multiDragState.anchorId === instance.id) return
    // Skip if this item is not part of the multi-drag
    if (!multiDragState.startPositions.has(instance.id)) return

    // Get the calculated position from multi-drag state
    const newPos = getMultiDragPosition(instance.id)
    if (newPos) {
      groupRef.current.position.x = newPos.x
      groupRef.current.position.z = newPos.z
    }
  })

  // Handle dimension change from resize handles
  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', newValue: number) => {
    updateItem(item.id, {
      dimensions: {
        ...item.dimensions,
        [dimension]: newValue
      }
    })
  }

  // Exit resize mode when deselected
  useEffect(() => {
    if (!isSelected && isResizeMode) {
      setResizeMode(false)
    }
  }, [isSelected, isResizeMode, setResizeMode])

  // Handle drag movement - SINGLE-CLICK-DRAG pattern
  // Click immediately starts potential drag, with threshold to prevent accidental micro-drags
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    // Don't start drag in resize mode or if camera mode is active
    if (isResizeMode || mode === 'camera') return

    // Clear wall/floor selection when selecting furniture
    clearSelection()

    // Handle multi-select with modifier keys
    const isShiftHeld = e.nativeEvent.shiftKey
    const isMetaOrCtrlHeld = e.nativeEvent.metaKey || e.nativeEvent.ctrlKey

    if (isMetaOrCtrlHeld) {
      // Cmd/Ctrl+Click: Toggle selection
      toggleInstanceSelection(instance.id)
      // Don't start drag when toggling
      return
    } else if (isShiftHeld) {
      // Shift+Click: Add to selection
      selectInstance(instance.id, true)
    } else if (!isInstanceSelected(instance.id)) {
      // Regular click on unselected item: Select only this item
      selectInstance(instance.id, false)
    }
    // If already selected and no modifier, keep current selection (allows multi-drag)

    // Also update the old selection context for compatibility
    selectFurniture(instance.id, instance.roomId)

    // Calculate where the click intersects the drag plane (Y=0)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)
    const clickOnPlane = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlaneRef.current, clickOnPlane)

    // Store the offset from click point to object center (so dragging feels natural)
    dragOffsetRef.current = new THREE.Vector2(
      instance.position.x - clickOnPlane.x,
      instance.position.z - clickOnPlane.z
    )

    // Start potential drag immediately (single-click-drag pattern)
    setIsDragging(true)
    setIsVisuallyDragging(false)
    dragStartPosRef.current = clickOnPlane.clone()
    setMode('dragging')
    document.body.style.cursor = 'grab'

    // If multiple items are selected, start multi-drag coordination
    // Need to determine selected items AFTER potential selection change above
    // Use a microtask to ensure state is updated
    queueMicrotask(() => {
      // Get current selection (may have just changed)
      const currentSelection = isInstanceSelected(instance.id) ? selectedInstanceIds : [instance.id]

      if (currentSelection.length > 1 && currentRoom?.instances) {
        // Collect starting positions of all selected items
        const startPositions = new Map<string, { x: number; z: number }>()
        currentRoom.instances.forEach(inst => {
          if (currentSelection.includes(inst.id)) {
            startPositions.set(inst.id, { x: inst.position.x, z: inst.position.z })
          }
        })
        startMultiDrag(instance.id, startPositions)
      }
    })
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation() // FIX: Was missing - prevents camera from also receiving event

    if (isDragging) {
      // Commit final position to state only on release (avoids re-renders during drag)
      if (dragPositionRef.current) {
        updateInstance(instance.id, {
          position: {
            ...instance.position,
            x: dragPositionRef.current.x,
            z: dragPositionRef.current.z
          }
        })
      }
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      dragPositionRef.current = null
      setMode('idle')
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStartPosRef.current || !dragOffsetRef.current) return

    e.stopPropagation()

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)

    const intersectionPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersectionPoint)

    if (intersectionPoint) {
      // Check if we've exceeded drag threshold before visually dragging
      if (!isVisuallyDragging) {
        const distance = intersectionPoint.distanceTo(dragStartPosRef.current)
        if (distance < DRAG_THRESHOLD) {
          return // Don't start visual drag yet
        }
        setIsVisuallyDragging(true)
        document.body.style.cursor = 'grabbing'
      }

      // Calculate new position with offset
      const newX = intersectionPoint.x + dragOffsetRef.current.x
      const newZ = intersectionPoint.z + dragOffsetRef.current.y

      // Store position for commit on release
      dragPositionRef.current = { x: newX, z: newZ }

      // Update visual position directly via ref (no React re-render)
      if (groupRef.current) {
        groupRef.current.position.x = newX
        groupRef.current.position.z = newZ
      }

      // Update multi-drag delta for other selected items
      if (multiDragState && multiDragState.anchorId === instance.id) {
        const startPos = multiDragState.startPositions.get(instance.id)
        if (startPos) {
          updateMultiDragDelta(newX - startPos.x, newZ - startPos.z)
        }
      }
    }
  }

  return (
    <>
      {/* Outer group: position and rotation only */}
      {/* Y position includes yOffset to place model bottom at Y=0 after scaling */}
      <group
        ref={groupRef}
        position={[instance.position.x, instance.position.y + yOffset, instance.position.z]}
        rotation={[instance.rotation.x, instance.rotation.y, instance.rotation.z]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHoveredFurnitureId(instance.id)
          setHoveredItem({ type: 'furniture', instanceId: instance.id, roomId: instance.roomId })
          // Show appropriate cursor based on state
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
        onClick={(e) => e.stopPropagation()} // Prevent floor click from firing
      >
        {/* Inner group: non-uniform scaling only */}
        {/* Scaling is applied first (in local space), then rotation is applied to the scaled result */}
        <group
          scale={[
            instance.scaleMultiplier.x * autoScale.x,
            instance.scaleMultiplier.y * autoScale.y,
            instance.scaleMultiplier.z * autoScale.z
          ]}
        >
          <primitive object={clonedScene} castShadow receiveShadow />

          {/* Outline border when hovered or selected (not in resize mode) */}
          {/* raycast={null} prevents these visual elements from intercepting clicks */}
          {/* Position at center.y (model's actual center) since we don't center Y in clonedScene */}
          {(isHovered || isSelected) && !isResizeMode && (
            <>
              <mesh position={[0, center.y, 0]} raycast={() => null}>
                <boxGeometry args={[size.x * 1.05, size.y * 1.05, size.z * 1.05]} />
                <meshBasicMaterial
                  color={isSelected ? "#ffa500" : "#00ffff"}
                  wireframe
                  transparent
                  opacity={0.6}
                />
              </mesh>
              <lineSegments position={[0, center.y, 0]} raycast={() => null}>
                <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.03, size.y * 1.03, size.z * 1.03)]} />
                <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
              </lineSegments>
              <lineSegments position={[0, center.y, 0]} raycast={() => null}>
                <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.01, size.y * 1.01, size.z * 1.01)]} />
                <lineBasicMaterial color="#ffffff" />
              </lineSegments>
            </>
          )}
        </group>
      </group>

      {/* Resize handles rendered outside the scaled group at world-space positions */}
      {isSelected && isResizeMode && (
        <ResizeHandles
          dimensions={item.dimensions}
          position={instance.position}
          onDimensionChange={handleDimensionChange}
        />
      )}
    </>
  )
}

function PlaceholderItemInstance({ instance, item }: ItemInstanceProps) {
  return (
    <mesh
      position={[instance.position.x, instance.position.y, instance.position.z]}
      rotation={[instance.rotation.x, instance.rotation.y, instance.rotation.z]}
      scale={[instance.scaleMultiplier.x, instance.scaleMultiplier.y, instance.scaleMultiplier.z]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={getCategoryColor(item.category)} />
    </mesh>
  )
}

/**
 * ParametricShapeInstanceModel: Renders a parametric shape with full drag/select/hover support
 * This mirrors ItemInstanceModel but for parametric shapes instead of GLB models
 */
function ParametricShapeInstanceModel({ instance, item }: ItemInstanceProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  const {
    selectedInstanceIds,
    selectInstance,
    toggleInstanceSelection,
    isInstanceSelected,
    clearInstanceSelection,
    multiDragState,
    startMultiDrag,
    updateMultiDragDelta,
    endMultiDrag,
    getMultiDragPosition
  } = useFurnitureSelection()
  const { selectFurniture, isFurnitureSelected, hoveredItem, setHoveredItem, clearSelection } = useSelection()
  const { updateInstance, currentRoom } = useRoom()
  const { updateItem } = useItemLibrary()
  const { isResizeMode, setResizeMode } = useResizeMode()
  const { mode, setMode } = useInteractionMode()
  const { camera, gl } = useThree()
  // Check both old hover context and new selection context hover
  const isHovered = hoveredFurnitureId === instance.id ||
    (hoveredItem?.type === 'furniture' && hoveredItem.instanceId === instance.id)
  // Check multi-select state
  const isSelected = isInstanceSelected(instance.id) || isFurnitureSelected(instance.id)
  const [isDragging, setIsDragging] = useState(false)
  const [isVisuallyDragging, setIsVisuallyDragging] = useState(false)
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null)
  const dragOffsetRef = useRef<THREE.Vector2 | null>(null) // Offset from cursor to object center
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const dragPositionRef = useRef<{ x: number; z: number } | null>(null) // Current drag position for direct updates

  const shape = item.parametricShape!

  // Calculate bounding box for outline using the unified dimension calculator
  const { boundingSize, boundingCenter } = useMemo(() => {
    const dimensions = calculateShapeDimensions(shape)
    return {
      boundingSize: new THREE.Vector3(dimensions.width, dimensions.height, dimensions.depth),
      boundingCenter: new THREE.Vector3(0, dimensions.height / 2, 0)
    }
  }, [shape])

  // Apply highlight effect when hovered or selected
  useEffect(() => {
    if (!meshRef.current) return

    const mesh = meshRef.current
    if (isHovered || isSelected) {
      if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material
      }
      const originalMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial
      const highlightMaterial = originalMat.clone()
      const color = isSelected ? 0xffa500 : 0x00ffff
      highlightMaterial.emissive = new THREE.Color(color)
      highlightMaterial.emissiveIntensity = isVisuallyDragging ? 1.2 : (isSelected ? 0.5 : 0.3)
      mesh.material = highlightMaterial
    } else if (mesh.userData.originalMaterial) {
      mesh.material = mesh.userData.originalMaterial
    }
  }, [isHovered, isSelected, isVisuallyDragging])

  // Handle arrow key movement and resize mode toggle when selected
  useEffect(() => {
    if (!isSelected) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        setResizeMode(!isResizeMode)
        return
      }

      if (isResizeMode) return

      const moveSpeed = 0.5
      let newX = instance.position.x
      let newZ = instance.position.z

      switch (e.key) {
        case 'ArrowUp':
          newZ -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowDown':
          newZ += moveSpeed
          e.preventDefault()
          break
        case 'ArrowLeft':
          newX -= moveSpeed
          e.preventDefault()
          break
        case 'ArrowRight':
          newX += moveSpeed
          e.preventDefault()
          break
        default:
          return
      }

      updateInstance(instance.id, {
        position: { ...instance.position, x: newX, z: newZ }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelected, instance.id, instance.position, updateInstance, isResizeMode, setResizeMode])

  // Global pointerup listener to prevent stuck drag state when releasing outside the object
  useEffect(() => {
    if (!isDragging) return

    const handleGlobalPointerUp = () => {
      // Check if this is the anchor of a multi-drag
      if (multiDragState && multiDragState.anchorId === instance.id) {
        // End multi-drag and get final positions for all items
        const finalPositions = endMultiDrag()
        if (finalPositions) {
          // Update all items' positions
          finalPositions.forEach((pos, instanceId) => {
            updateInstance(instanceId, {
              position: { x: pos.x, y: 0, z: pos.z }
            })
          })
        }
      } else if (dragPositionRef.current) {
        // Single item drag - commit final position
        updateInstance(instance.id, {
          position: {
            ...instance.position,
            x: dragPositionRef.current.x,
            z: dragPositionRef.current.z
          }
        })
      }

      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      dragPositionRef.current = null
      setMode('idle')
      document.body.style.cursor = 'default'
    }

    // Use window to catch pointerup anywhere
    window.addEventListener('pointerup', handleGlobalPointerUp)
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp)
  }, [isDragging, setMode, instance.id, instance.position, updateInstance, multiDragState, endMultiDrag])

  // Follow multi-drag delta for non-anchor selected items
  // This runs every frame to smoothly update position during multi-drag
  useFrame(() => {
    if (!groupRef.current) return
    if (!multiDragState) return
    // Skip if this is the anchor (it handles its own movement)
    if (multiDragState.anchorId === instance.id) return
    // Skip if this item is not part of the multi-drag
    if (!multiDragState.startPositions.has(instance.id)) return

    // Get the calculated position from multi-drag state
    const newPos = getMultiDragPosition(instance.id)
    if (newPos) {
      groupRef.current.position.x = newPos.x
      groupRef.current.position.z = newPos.z
    }
  })

  // Handle dimension change from resize handles
  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', newValue: number) => {
    updateItem(item.id, {
      dimensions: {
        ...item.dimensions,
        [dimension]: newValue
      }
    })
  }

  // Exit resize mode when deselected
  useEffect(() => {
    if (!isSelected && isResizeMode) {
      setResizeMode(false)
    }
  }, [isSelected, isResizeMode, setResizeMode])

  // Handle drag movement - SINGLE-CLICK-DRAG pattern
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    if (isResizeMode || mode === 'camera') return

    // Clear wall/floor selection when selecting furniture
    clearSelection()

    // Handle multi-select with modifier keys
    const isShiftHeld = e.nativeEvent.shiftKey
    const isMetaOrCtrlHeld = e.nativeEvent.metaKey || e.nativeEvent.ctrlKey

    if (isMetaOrCtrlHeld) {
      // Cmd/Ctrl+Click: Toggle selection
      toggleInstanceSelection(instance.id)
      // Don't start drag when toggling
      return
    } else if (isShiftHeld) {
      // Shift+Click: Add to selection
      selectInstance(instance.id, true)
    } else if (!isInstanceSelected(instance.id)) {
      // Regular click on unselected item: Select only this item
      selectInstance(instance.id, false)
    }
    // If already selected and no modifier, keep current selection (allows multi-drag)

    // Also update the old selection context for compatibility
    selectFurniture(instance.id, instance.roomId)

    // Calculate where the click intersects the drag plane (Y=0)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)
    const clickOnPlane = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlaneRef.current, clickOnPlane)

    // Store the offset from click point to object center (so dragging feels natural)
    dragOffsetRef.current = new THREE.Vector2(
      instance.position.x - clickOnPlane.x,
      instance.position.z - clickOnPlane.z
    )

    setIsDragging(true)
    setIsVisuallyDragging(false)
    dragStartPosRef.current = clickOnPlane.clone()
    setMode('dragging')
    document.body.style.cursor = 'grab'

    // If multiple items are selected, start multi-drag coordination
    queueMicrotask(() => {
      const currentSelection = isInstanceSelected(instance.id) ? selectedInstanceIds : [instance.id]

      if (currentSelection.length > 1 && currentRoom?.instances) {
        const startPositions = new Map<string, { x: number; z: number }>()
        currentRoom.instances.forEach(inst => {
          if (currentSelection.includes(inst.id)) {
            startPositions.set(inst.id, { x: inst.position.x, z: inst.position.z })
          }
        })
        startMultiDrag(instance.id, startPositions)
      }
    })
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    if (isDragging) {
      // Commit final position to state only on release (avoids re-renders during drag)
      if (dragPositionRef.current) {
        updateInstance(instance.id, {
          position: {
            ...instance.position,
            x: dragPositionRef.current.x,
            z: dragPositionRef.current.z
          }
        })
      }
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      dragPositionRef.current = null
      setMode('idle')
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStartPosRef.current || !dragOffsetRef.current) return

    e.stopPropagation()

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(getNDC(e.nativeEvent, gl.domElement), camera)

    const intersectionPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(dragPlaneRef.current, intersectionPoint)

    if (intersectionPoint) {
      if (!isVisuallyDragging) {
        const distance = intersectionPoint.distanceTo(dragStartPosRef.current)
        if (distance < DRAG_THRESHOLD) {
          return
        }
        setIsVisuallyDragging(true)
        document.body.style.cursor = 'grabbing'
      }

      // Calculate new position with offset
      const newX = intersectionPoint.x + dragOffsetRef.current.x
      const newZ = intersectionPoint.z + dragOffsetRef.current.y

      // Store position for commit on release
      dragPositionRef.current = { x: newX, z: newZ }

      // Update visual position directly via ref (no React re-render)
      if (groupRef.current) {
        groupRef.current.position.x = newX
        groupRef.current.position.z = newZ
      }

      // Update multi-drag delta for other selected items
      if (multiDragState && multiDragState.anchorId === instance.id) {
        const startPos = multiDragState.startPositions.get(instance.id)
        if (startPos) {
          updateMultiDragDelta(newX - startPos.x, newZ - startPos.z)
        }
      }
    }
  }

  // Check if this is a simple shape type that should use ParametricShapeRenderer
  // (rug, frame, shelf) vs extrusion which we render manually for highlight effects
  const isSimpleShape = shape.type !== 'extrusion'

  // Create geometry (only for extrusion shapes - others use ParametricShapeRenderer)
  const geometry = useMemo(() => {
    if (shape.type !== 'extrusion') {
      // For non-extrusion shapes, create a placeholder geometry
      // The actual rendering is handled by ParametricShapeRenderer
      const dims = calculateShapeDimensions(shape)
      return new THREE.BoxGeometry(dims.width, dims.height, dims.depth)
    }

    if (!shape.points || shape.points.length < 3) {
      return new THREE.BoxGeometry(1, shape.height, 1)
    }

    const threeShape = new THREE.Shape()
    threeShape.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      threeShape.lineTo(shape.points[i].x, shape.points[i].y)
    }
    threeShape.lineTo(shape.points[0].x, shape.points[0].y)

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: shape.height,
      bevelEnabled: false
    }

    const extrudeGeometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings)
    extrudeGeometry.rotateX(-Math.PI / 2)

    extrudeGeometry.computeBoundingBox()
    const boundingBox = extrudeGeometry.boundingBox!
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
    const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2
    extrudeGeometry.translate(-centerX, 0, -centerZ)

    return extrudeGeometry
  }, [shape])

  // Create material (only for extrusion shapes)
  const material = useMemo(() => {
    if (shape.type !== 'extrusion') {
      return new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.7, metalness: 0.1 })
    }
    return new THREE.MeshStandardMaterial({
      color: shape.color || '#808080',
      roughness: 0.7,
      metalness: 0.1
    })
  }, [shape])

  return (
    <>
      <group
        ref={groupRef}
        position={[instance.position.x, instance.position.y, instance.position.z]}
        rotation={[instance.rotation.x, instance.rotation.y, instance.rotation.z]}
        scale={[instance.scaleMultiplier.x, instance.scaleMultiplier.y, instance.scaleMultiplier.z]}
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
        onClick={(e) => e.stopPropagation()} // Prevent floor click from firing
      >
        {isSimpleShape ? (
          <ParametricShapeRenderer
            shape={shape}
            instanceId={instance.id}
            castShadow
            receiveShadow
          />
        ) : (
          <mesh
            ref={meshRef}
            geometry={geometry}
            material={material}
            castShadow
            receiveShadow
          />
        )}

        {/* Outline border when hovered or selected (not in resize mode) */}
        {/* raycast={() => null} prevents these visual elements from intercepting clicks */}
        {(isHovered || isSelected) && !isResizeMode && (
          <>
            <mesh position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]} raycast={() => null}>
              <boxGeometry args={[boundingSize.x * 1.05, boundingSize.y * 1.05, boundingSize.z * 1.05]} />
              <meshBasicMaterial
                color={isSelected ? "#ffa500" : "#00ffff"}
                wireframe
                transparent
                opacity={0.6}
              />
            </mesh>
            <lineSegments position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]} raycast={() => null}>
              <edgesGeometry args={[new THREE.BoxGeometry(boundingSize.x * 1.03, boundingSize.y * 1.03, boundingSize.z * 1.03)]} />
              <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
            </lineSegments>
            <lineSegments position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]} raycast={() => null}>
              <edgesGeometry args={[new THREE.BoxGeometry(boundingSize.x * 1.01, boundingSize.y * 1.01, boundingSize.z * 1.01)]} />
              <lineBasicMaterial color="#ffffff" />
            </lineSegments>
          </>
        )}
      </group>

      {/* Resize handles rendered outside the scaled group at world-space positions */}
      {isSelected && isResizeMode && (
        <ResizeHandles
          dimensions={item.dimensions}
          position={instance.position}
          onDimensionChange={handleDimensionChange}
        />
      )}
    </>
  )
}

/**
 * ItemInstanceRenderer: Renders an item instance by fetching the item from the library
 * Routes wall-mounted items to WallItemInstance for wall-relative positioning
 */
export function ItemInstanceRenderer({ instance }: { instance: ItemInstance }) {
  const { getItem } = useItemLibrary()
  const item = getItem(instance.itemId)

  if (!item) {
    console.warn(`Item not found for instance ${instance.id}: ${instance.itemId}`)
    return null
  }

  // Route wall-mounted items to WallItemInstance
  // Check both item placement type and whether instance has wall placement data
  const isWallItem = item.placementType === 'wall' || instance.wallPlacement

  if (isWallItem) {
    return (
      <ModelErrorBoundary fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
        <Suspense fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
          <WallItemInstance instance={instance} item={item} />
        </Suspense>
      </ModelErrorBoundary>
    )
  }

  // If item has a parametric shape, render it using ParametricShapeInstanceModel (with full drag support)
  if (item.parametricShape) {
    return (
      <ParametricShapeInstanceModel instance={instance} item={item} />
    )
  }

  // Skip rendering if model path is invalid/placeholder
  if (!item.modelPath || item.modelPath === 'placeholder') {
    console.warn(`Item ${item.id} has no valid model path, skipping render`)
    return null
  }

  return (
    <ModelErrorBoundary fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
      <Suspense fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
        <ItemInstanceModel instance={instance} item={item} />
      </Suspense>
    </ModelErrorBoundary>
  )
}
