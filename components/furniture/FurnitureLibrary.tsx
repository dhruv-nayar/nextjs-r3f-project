'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { FurnitureItem, Item, ItemInstance } from '@/types/room'
import { useFurnitureHover } from '@/lib/furniture-hover-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import * as THREE from 'three'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'

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
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { updateInstance } = useRoom()
  const { camera, gl } = useThree()
  const isHovered = hoveredFurnitureId === instance.id
  const isSelected = selectedFurnitureId === instance.id
  const [isDragging, setIsDragging] = useState(false)
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
            highlightMaterial.emissive = new THREE.Color(isSelected ? 0xffa500 : 0x00ffff)
            highlightMaterial.emissiveIntensity = 0.8
          }
          child.material = highlightMaterial
        } else if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial
        }
      }
    })
  }, [isHovered, isSelected])

  // Handle arrow key movement when selected
  useEffect(() => {
    if (!isSelected) return

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [isSelected, instance.id, instance.position, updateInstance])

  // Handle drag movement
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!isSelected) {
      e.stopPropagation()
      setSelectedFurnitureId(instance.id)
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
      updateInstance(instance.id, {
        position: { ...instance.position, x: intersectionPoint.x, z: intersectionPoint.z }
      })
    }
  }

  return (
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

      {/* Outline border when hovered or selected */}
      {(isHovered || isSelected) && (
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
 * ItemInstanceRenderer: Renders an item instance by fetching the item from the library
 */
export function ItemInstanceRenderer({ instance }: { instance: ItemInstance }) {
  const { getItem } = useItemLibrary()
  const item = getItem(instance.itemId)

  if (!item) {
    console.warn(`Item not found for instance ${instance.id}: ${instance.itemId}`)
    return null
  }

  return (
    <Suspense fallback={<PlaceholderItemInstance instance={instance} item={item} />}>
      <ItemInstanceModel instance={instance} item={item} />
    </Suspense>
  )
}
