'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { FurnitureItem, Item, ItemInstance, ParametricShape } from '@/types/room'
import { ParametricShapeRenderer } from '@/components/items/ParametricShapeRenderer'
import { useFurnitureHover } from '@/lib/furniture-hover-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useSelection } from '@/lib/selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { useResizeMode } from '@/lib/resize-mode-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { ResizeHandles } from './ResizeHandles'
import * as THREE from 'three'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'

// Drag threshold in world units - prevents accidental micro-drags
const DRAG_THRESHOLD = 0.1

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
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.nativeEvent.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(e.nativeEvent.clientY / gl.domElement.clientHeight) * 2 + 1
      ),
      camera
    )

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
    >
      <primitive object={clonedScene} castShadow receiveShadow />

      {/* Outline border when hovered or selected - using multiple layers */}
      {(isHovered || isSelected) && (
        <>
          {/* Outer glow box */}
          <mesh position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
            <boxGeometry args={[size.x * 1.05, size.y * 1.05, size.z * 1.05]} />
            <meshBasicMaterial
              color={isSelected ? "#ffa500" : "#00ffff"}
              wireframe
              transparent
              opacity={0.6}
            />
          </mesh>
          {/* Middle outline */}
          <lineSegments position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
            <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.03, size.y * 1.03, size.z * 1.03)]} />
            <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
          </lineSegments>
          {/* Inner outline */}
          <lineSegments position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
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
  const { scene } = useGLTF(item.modelPath)
  const clonedScene = scene.clone()
  const groupRef = useRef<THREE.Group>(null)
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  // Use both old and new selection context during migration
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { selectFurniture, isFurnitureSelected, hoveredItem, setHoveredItem } = useSelection()
  const { updateInstance, currentRoom } = useRoom()
  const { updateItem } = useItemLibrary()
  const { isResizeMode, setResizeMode } = useResizeMode()
  const { mode, setMode } = useInteractionMode()
  const { camera, gl } = useThree()
  const isHovered = hoveredFurnitureId === instance.id
  // Check both old and new selection systems
  const isSelected = selectedFurnitureId === instance.id || isFurnitureSelected(instance.id)
  const [isDragging, setIsDragging] = useState(false)
  const [isVisuallyDragging, setIsVisuallyDragging] = useState(false)
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null)
  const dragOffsetRef = useRef<THREE.Vector2 | null>(null) // Offset from cursor to object center
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Calculate the model's original bounding box
  const box = new THREE.Box3().setFromObject(clonedScene)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  // Calculate auto-scale based on item dimensions
  const autoScale = {
    x: item.dimensions.width / size.x,
    y: item.dimensions.height / size.y,
    z: item.dimensions.depth / size.z
  }

  // Center X and Z, but place bottom at Y=0 (before any scaling)
  clonedScene.position.set(-center.x, -box.min.y, -center.z)

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

    // Select the item
    setSelectedFurnitureId(instance.id)
    selectFurniture(instance.id, instance.roomId)

    // Calculate where the click intersects the drag plane (Y=0)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.nativeEvent.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(e.nativeEvent.clientY / gl.domElement.clientHeight) * 2 + 1
      ),
      camera
    )
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
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation() // FIX: Was missing - prevents camera from also receiving event

    if (isDragging) {
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      setMode('idle')
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStartPosRef.current || !dragOffsetRef.current) return

    e.stopPropagation()

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.nativeEvent.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(e.nativeEvent.clientY / gl.domElement.clientHeight) * 2 + 1
      ),
      camera
    )

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

      // Move the furniture with offset so it stays under the cursor where you grabbed it
      updateInstance(instance.id, {
        position: {
          ...instance.position,
          x: intersectionPoint.x + dragOffsetRef.current.x,
          z: intersectionPoint.z + dragOffsetRef.current.y
        }
      })
    }
  }

  return (
    <>
      {/* Main model group with scaling */}
      <group
        ref={groupRef}
        position={[instance.position.x, instance.position.y, instance.position.z]}
        rotation={[instance.rotation.x, instance.rotation.y, instance.rotation.z]}
        scale={[
          instance.scaleMultiplier.x * autoScale.x,
          instance.scaleMultiplier.y * autoScale.y,
          instance.scaleMultiplier.z * autoScale.z
        ]}
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
      >
        <primitive object={clonedScene} castShadow receiveShadow />

        {/* Outline border when hovered or selected (not in resize mode) */}
        {(isHovered || isSelected) && !isResizeMode && (
          <>
            <mesh position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
              <boxGeometry args={[size.x * 1.05, size.y * 1.05, size.z * 1.05]} />
              <meshBasicMaterial
                color={isSelected ? "#ffa500" : "#00ffff"}
                wireframe
                transparent
                opacity={0.6}
              />
            </mesh>
            <lineSegments position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
              <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.03, size.y * 1.03, size.z * 1.03)]} />
              <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
            </lineSegments>
            <lineSegments position={[-center.x, size.y / 2 - box.min.y, -center.z]}>
              <edgesGeometry args={[new THREE.BoxGeometry(size.x * 1.01, size.y * 1.01, size.z * 1.01)]} />
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
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { selectFurniture, isFurnitureSelected, setHoveredItem } = useSelection()
  const { updateInstance, currentRoom } = useRoom()
  const { updateItem } = useItemLibrary()
  const { isResizeMode, setResizeMode } = useResizeMode()
  const { mode, setMode } = useInteractionMode()
  const { camera, gl } = useThree()
  const isHovered = hoveredFurnitureId === instance.id
  const isSelected = selectedFurnitureId === instance.id || isFurnitureSelected(instance.id)
  const [isDragging, setIsDragging] = useState(false)
  const [isVisuallyDragging, setIsVisuallyDragging] = useState(false)
  const dragStartPosRef = useRef<THREE.Vector3 | null>(null)
  const dragOffsetRef = useRef<THREE.Vector2 | null>(null) // Offset from cursor to object center
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  const shape = item.parametricShape!

  // Calculate bounding box for outline
  const { boundingSize, boundingCenter } = useMemo(() => {
    if (!shape.points || shape.points.length < 3) {
      return { boundingSize: new THREE.Vector3(1, shape.height, 1), boundingCenter: new THREE.Vector3(0, shape.height / 2, 0) }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const point of shape.points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }

    const width = maxX - minX
    const depth = maxY - minY
    const height = shape.height

    return {
      boundingSize: new THREE.Vector3(width, height, depth),
      boundingCenter: new THREE.Vector3(0, height / 2, 0)
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

    setSelectedFurnitureId(instance.id)
    selectFurniture(instance.id, instance.roomId)

    // Calculate where the click intersects the drag plane (Y=0)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.nativeEvent.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(e.nativeEvent.clientY / gl.domElement.clientHeight) * 2 + 1
      ),
      camera
    )
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
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()

    if (isDragging) {
      setIsDragging(false)
      setIsVisuallyDragging(false)
      dragStartPosRef.current = null
      dragOffsetRef.current = null
      setMode('idle')
      document.body.style.cursor = isHovered ? 'pointer' : 'default'
    }
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging || !dragStartPosRef.current || !dragOffsetRef.current) return

    e.stopPropagation()

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(
      new THREE.Vector2(
        (e.nativeEvent.clientX / gl.domElement.clientWidth) * 2 - 1,
        -(e.nativeEvent.clientY / gl.domElement.clientHeight) * 2 + 1
      ),
      camera
    )

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

      // Apply the offset so the object stays under the cursor where you grabbed it
      updateInstance(instance.id, {
        position: {
          ...instance.position,
          x: intersectionPoint.x + dragOffsetRef.current.x,
          z: intersectionPoint.z + dragOffsetRef.current.y
        }
      })
    }
  }

  // Create geometry
  const geometry = useMemo(() => {
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

  // Create material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shape.color || '#808080',
      roughness: 0.7,
      metalness: 0.1
    })
  }, [shape.color])

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
      >
        <mesh
          ref={meshRef}
          geometry={geometry}
          material={material}
          castShadow
          receiveShadow
        />

        {/* Outline border when hovered or selected (not in resize mode) */}
        {(isHovered || isSelected) && !isResizeMode && (
          <>
            <mesh position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]}>
              <boxGeometry args={[boundingSize.x * 1.05, boundingSize.y * 1.05, boundingSize.z * 1.05]} />
              <meshBasicMaterial
                color={isSelected ? "#ffa500" : "#00ffff"}
                wireframe
                transparent
                opacity={0.6}
              />
            </mesh>
            <lineSegments position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]}>
              <edgesGeometry args={[new THREE.BoxGeometry(boundingSize.x * 1.03, boundingSize.y * 1.03, boundingSize.z * 1.03)]} />
              <lineBasicMaterial color={isSelected ? "#ffa500" : "#00ffff"} />
            </lineSegments>
            <lineSegments position={[boundingCenter.x, boundingCenter.y, boundingCenter.z]}>
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
 */
export function ItemInstanceRenderer({ instance }: { instance: ItemInstance }) {
  const { getItem } = useItemLibrary()
  const item = getItem(instance.itemId)

  if (!item) {
    console.warn(`Item not found for instance ${instance.id}: ${instance.itemId}`)
    return null
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
    <Suspense fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
      <ItemInstanceModel instance={instance} item={item} />
    </Suspense>
  )
}
