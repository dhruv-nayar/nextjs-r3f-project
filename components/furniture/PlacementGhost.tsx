'use client'

import { Suspense, useRef, useMemo, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { useItemLibrary } from '@/lib/item-library-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import { useWallMesh } from '@/lib/contexts/wall-mesh-context'
import { useSurfaceMesh, SurfaceHit } from '@/lib/contexts/surface-mesh-context'
import * as THREE from 'three'
import { ParametricShape, PlacementType, WallPlacement } from '@/types/room'
import { ParametricShapeRenderer, calculateShapeDimensions } from '@/components/items/ParametricShapeRenderer'
import { worldToWallRelative, getWallFacingRotation, getWallNormal } from '@/lib/utils/wall-coordinates'

interface PlacementGhostProps {
  itemId: string
  position: { x: number; y: number; z: number }
}

function GhostModel({ itemId }: { itemId: string }) {
  const { getItem } = useItemLibrary()
  const { confirmPlacement, cancelPlacement } = useInteractionMode()
  const { currentRoom } = useRoom()
  const { addInstanceToRoom, updateInstance } = useHome()
  const { camera } = useThree()
  const { getAllWallMeshes, getAllCeilingMeshes } = useWallMesh()
  const { raycastSurfaces, getAllPlaceableSurfaces } = useSurfaceMesh()
  const item = getItem(itemId)
  const groupRef = useRef<THREE.Group>(null)
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Get room height for ceiling placement
  const roomHeight = currentRoom?.dimensions?.height || 10

  // Create ceiling plane at room height
  const ceilingPlane = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), roomHeight))

  // Use local state for real-time position updates (not context)
  const [localPosition, setLocalPosition] = useState({ x: 0, y: 0, z: 0 })
  const positionRef = useRef({ x: 0, y: 0, z: 0 })
  const rotationRef = useRef({ x: 0, y: 0, z: 0 })
  const wallPlacementRef = useRef<WallPlacement | null>(null)
  const surfaceParentRef = useRef<{ surfaceId: string; surfaceType: 'floor' | 'item'; surfacePosition: { x: number; y: number; z: number } } | null>(null)

  // Get placement type from item
  const placementType: PlacementType = item?.placementType || 'floor'

  // Handle Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelPlacement()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelPlacement])

  // Track pointer for placement position - update ref directly for smooth movement
  useFrame((state) => {
    const pointer = state.pointer
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)

    let newPosition: { x: number; y: number; z: number } | null = null
    let newRotation: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

    if (placementType === 'floor') {
      // Floor placement - raycast to surfaces (floor and item surfaces like rugs/shelves)
      // First try registered surfaces
      const surfaceHit = raycastSurfaces(raycaster)

      if (surfaceHit) {
        // Place at the hit point on the surface
        newPosition = {
          x: surfaceHit.point.x,
          y: surfaceHit.point.y,
          z: surfaceHit.point.z
        }

        // Track surface parent for hierarchy
        // Get surface world position for relative positioning
        const surfaceMesh = surfaceHit.mesh
        const surfaceWorldPos = new THREE.Vector3()
        surfaceMesh.getWorldPosition(surfaceWorldPos)

        surfaceParentRef.current = {
          surfaceId: surfaceHit.surfaceId,
          surfaceType: surfaceHit.surfaceType,
          surfacePosition: {
            x: surfaceWorldPos.x,
            y: surfaceWorldPos.y,
            z: surfaceWorldPos.z
          }
        }
      } else {
        // Fallback: raycast to floor plane (Y=0) when no surfaces registered
        const intersectionPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(floorPlane.current, intersectionPoint)) {
          newPosition = {
            x: intersectionPoint.x,
            y: 0,
            z: intersectionPoint.z
          }
          // Default to floor parent
          surfaceParentRef.current = {
            surfaceId: 'floor',
            surfaceType: 'floor',
            surfacePosition: { x: 0, y: 0, z: 0 }
          }
        }
      }
    } else if (placementType === 'ceiling') {
      // Ceiling placement - raycast to ceiling meshes or plane
      const ceilingMeshes = getAllCeilingMeshes()
      if (ceilingMeshes.length > 0) {
        const intersects = raycaster.intersectObjects(ceilingMeshes, false)
        if (intersects.length > 0) {
          const hit = intersects[0]
          newPosition = {
            x: hit.point.x,
            y: hit.point.y - 0.1, // Offset slightly below ceiling
            z: hit.point.z
          }
          // Rotate to hang from ceiling
          newRotation = { x: Math.PI, y: 0, z: 0 }
        }
      } else {
        // Fallback to ceiling plane
        const intersectionPoint = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(ceilingPlane.current, intersectionPoint)) {
          newPosition = {
            x: intersectionPoint.x,
            y: roomHeight - 0.1,
            z: intersectionPoint.z
          }
          newRotation = { x: Math.PI, y: 0, z: 0 }
        }
      }
    } else if (placementType === 'wall') {
      // Wall placement - raycast to wall meshes
      const wallMeshes = getAllWallMeshes()
      if (wallMeshes.length > 0) {
        const intersects = raycaster.intersectObjects(wallMeshes, false)
        if (intersects.length > 0) {
          const hit = intersects[0]
          const wallMesh = hit.object as THREE.Mesh
          const wallSide = wallMesh.userData.wallSide as 'north' | 'south' | 'east' | 'west'
          const roomId = wallMesh.userData.roomId as string

          // Get item dimensions for positioning
          const itemDepth = item?.dimensions?.depth || 0.5

          // Get the ACTUAL wall normal from the mesh's world transform
          // The wall geometry faces +Z in local space, so we transform (0,0,1) to world space
          // This works for walls at ANY angle, not just cardinal directions

          // Ensure the world matrix is up to date before reading
          wallMesh.updateWorldMatrix(true, false)

          const worldQuaternion = new THREE.Quaternion()
          wallMesh.getWorldQuaternion(worldQuaternion)
          const wallNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion)
          // Ensure normal is horizontal (zero out Y component and renormalize)
          wallNormal.y = 0
          if (wallNormal.length() < 0.01) {
            // Fallback if normal is degenerate
            wallNormal.set(0, 0, 1)
          } else {
            wallNormal.normalize()
          }

          // Ensure the normal points TOWARD the camera (item should face viewer)
          // If the normal points away from camera, flip it
          const toCamera = new THREE.Vector3().subVectors(camera.position, hit.point)
          toCamera.y = 0
          toCamera.normalize()
          if (wallNormal.dot(toCamera) < 0) {
            wallNormal.negate()
          }

          // Position in front of wall surface (offset along the normal direction)
          const WALL_BUFFER = 0.05
          const normalOffset = itemDepth / 2 + WALL_BUFFER

          newPosition = {
            x: hit.point.x + wallNormal.x * normalOffset,
            y: hit.point.y,
            z: hit.point.z + wallNormal.z * normalOffset
          }

          // Store wall placement data for instance creation
          wallPlacementRef.current = {
            roomId: roomId || currentRoom?.id || '',
            wallSide,
            heightFromFloor: hit.point.y,
            lateralOffset: 0,
            normalOffset
          }

          // Rotate item so its front face (-Z local) aligns with the wall normal
          // atan2(x, z) gives angle to point +Z toward (x, z)
          // Adding PI makes -Z (front face) point toward the normal instead
          let rotationY = Math.atan2(wallNormal.x, wallNormal.z) + Math.PI
          // Normalize to [-PI, PI] range
          if (rotationY > Math.PI) rotationY -= 2 * Math.PI
          if (rotationY < -Math.PI) rotationY += 2 * Math.PI
          newRotation = { x: 0, y: rotationY, z: 0 }
        }
      }
    }

    if (newPosition) {
      positionRef.current = newPosition
      rotationRef.current = newRotation

      // Update the group position and rotation directly (bypasses React state)
      if (groupRef.current) {
        groupRef.current.position.set(newPosition.x, newPosition.y, newPosition.z)
        groupRef.current.rotation.set(newRotation.x, newRotation.y, newRotation.z)
      }
    }
  })

  // Handle click to place
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    if (currentRoom) {
      // Convert world position to room-relative position
      // (instances are rendered inside a group with roomPosition, so we need local coords)
      const roomPosition = currentRoom.position || [0, 0, 0]
      const roomLocalPosition = {
        x: positionRef.current.x - roomPosition[0],
        y: positionRef.current.y - roomPosition[1],
        z: positionRef.current.z - roomPosition[2]
      }

      // Use room-local position for placement
      const instanceId = addInstanceToRoom(currentRoom.id, itemId, roomLocalPosition)

      // Combine placement rotation with item's default rotation
      const finalRotation = {
        x: rotationRef.current.x + (item?.defaultRotation?.x || 0),
        y: rotationRef.current.y, // Y from wall/surface orientation
        z: rotationRef.current.z + (item?.defaultRotation?.z || 0)
      }

      // Build update object
      const instanceUpdate: {
        rotation?: typeof finalRotation
        wallPlacement?: WallPlacement
        parentSurfaceId?: string
        parentSurfaceType?: 'floor' | 'item'
        position?: { x: number; y: number; z: number }
      } = {}

      // If rotation is set (from placement or item default), include it
      if (finalRotation.x !== 0 || finalRotation.y !== 0 || finalRotation.z !== 0) {
        instanceUpdate.rotation = finalRotation
      }

      // If this is a wall item, include wall placement data
      if (placementType === 'wall' && wallPlacementRef.current) {
        instanceUpdate.wallPlacement = wallPlacementRef.current
      }

      // If placing on a surface, include parent info and relative position
      if (placementType === 'floor' && surfaceParentRef.current) {
        const { surfaceId, surfaceType, surfacePosition } = surfaceParentRef.current
        instanceUpdate.parentSurfaceId = surfaceId
        instanceUpdate.parentSurfaceType = surfaceType

        // If placing on an item surface (not floor), store relative position
        if (surfaceType === 'item') {
          instanceUpdate.position = {
            x: positionRef.current.x - surfacePosition.x,
            y: positionRef.current.y - surfacePosition.y,
            z: positionRef.current.z - surfacePosition.z
          }
        }
      }

      // Apply updates if any
      if (Object.keys(instanceUpdate).length > 0) {
        // Small delay to ensure instance is created
        setTimeout(() => {
          updateInstance(instanceId, instanceUpdate)
        }, 0)
      }
    }
    cancelPlacement() // This exits placement mode
  }

  // Skip rendering if item not found
  if (!item) {
    return (
      <group ref={groupRef}>
        <mesh onClick={handleClick}>
          <boxGeometry args={[2, 1, 2]} />
          <meshStandardMaterial
            color={0x4ade80}
            transparent
            opacity={0.6}
          />
        </mesh>
        {/* Floor click target */}
        <mesh
          position={[0, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleClick}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    )
  }

  // If item has a parametric shape, render ghost version of that
  if (item.parametricShape) {
    return (
      <ParametricShapeGhost
        shape={item.parametricShape}
        handleClick={handleClick}
        groupRef={groupRef}
      />
    )
  }

  // Skip rendering GLB model if no model path
  if (!item.modelPath || item.modelPath === 'placeholder') {
    return (
      <group ref={groupRef}>
        <mesh onClick={handleClick}>
          <boxGeometry args={[item.dimensions.width, item.dimensions.height, item.dimensions.depth]} />
          <meshStandardMaterial
            color={0x4ade80}
            transparent
            opacity={0.6}
          />
        </mesh>
        {/* Floor click target */}
        <mesh
          position={[0, 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleClick}
        >
          <planeGeometry args={[1000, 1000]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    )
  }

  return (
    <GhostModelWithAsset
      itemId={itemId}
      item={item}
      handleClick={handleClick}
      groupRef={groupRef}
    />
  )
}

// Component for rendering a parametric shape as a ghost
function ParametricShapeGhost({
  shape,
  handleClick,
  groupRef
}: {
  shape: ParametricShape
  handleClick: (e: ThreeEvent<MouseEvent>) => void
  groupRef: React.RefObject<THREE.Group | null>
}) {
  // Create the extruded geometry from the shape points (for extrusion shapes only)
  // Other shapes use a simple box geometry based on calculated dimensions
  const geometry = useMemo(() => {
    if (shape.type !== 'extrusion') {
      // For non-extrusion shapes, use calculated dimensions for a box geometry
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

  // Calculate center Y offset for non-extrusion shapes
  const yOffset = useMemo(() => {
    if (shape.type === 'extrusion') return 0
    const dims = calculateShapeDimensions(shape)
    return dims.height / 2
  }, [shape])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x4ade80, // Green ghost color
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  }, [])

  return (
    <group ref={groupRef}>
      <mesh
        geometry={geometry}
        material={material}
        position={[0, yOffset, 0]}
        onClick={handleClick}
      />
      {/* Floor click target */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

// Separate component that loads the GLTF asset
function GhostModelWithAsset({
  itemId,
  item,
  handleClick,
  groupRef
}: {
  itemId: string
  item: NonNullable<ReturnType<ReturnType<typeof useItemLibrary>['getItem']>>
  handleClick: (e: ThreeEvent<MouseEvent>) => void
  groupRef: React.RefObject<THREE.Group | null>
}) {
  const { scene } = useGLTF(item.modelPath!)
  const clonedScene = useMemo(() => scene.clone(), [scene])

  // Calculate bounding box and auto-scale
  const { autoScale, center, size } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    return {
      autoScale: {
        x: item.dimensions.width / size.x,
        y: item.dimensions.height / size.y,
        z: item.dimensions.depth / size.z
      },
      center,
      size
    }
  }, [clonedScene, item.dimensions])

  // Center the model and apply ghost material
  useMemo(() => {
    clonedScene.position.set(-center.x, -clonedScene.userData.boxMin?.y || 0, -center.z)

    // Get the actual box min for proper grounding
    const box = new THREE.Box3().setFromObject(clonedScene)
    clonedScene.position.y = -box.min.y

    clonedScene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x4ade80, // Green tint
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        })
      }
    })
  }, [clonedScene, center])

  return (
    <group ref={groupRef}>
      {/* The actual model preview */}
      <group
        scale={[autoScale.x, autoScale.y, autoScale.z]}
        onClick={handleClick}
      >
        <primitive object={clonedScene} />
      </group>

      {/* Click target plane - covers the whole floor for easy clicking */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

function PlaceholderGhost() {
  const { cancelPlacement } = useInteractionMode()
  const { currentRoom } = useRoom()
  const { addInstanceToRoom } = useHome()
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const positionRef = useRef({ x: 0, y: 0, z: 0 })
  const { placementState } = useInteractionMode()

  // Handle Escape to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelPlacement()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelPlacement])

  // Track pointer position
  useFrame((state) => {
    const pointer = state.pointer
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pointer, camera)

    const intersectionPoint = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(floorPlane.current, intersectionPoint)) {
      positionRef.current = {
        x: intersectionPoint.x,
        y: 0,
        z: intersectionPoint.z
      }
      if (groupRef.current) {
        groupRef.current.position.set(intersectionPoint.x, 0, intersectionPoint.z)
      }
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (currentRoom && placementState.itemId) {
      addInstanceToRoom(currentRoom.id, placementState.itemId, positionRef.current)
    }
    cancelPlacement()
  }

  return (
    <group ref={groupRef}>
      <mesh onClick={handleClick}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial
          color={0x4ade80}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Floor click target */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
      >
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

export function PlacementGhost({ itemId }: PlacementGhostProps) {
  return (
    <Suspense fallback={<PlaceholderGhost />}>
      <GhostModel itemId={itemId} />
    </Suspense>
  )
}
