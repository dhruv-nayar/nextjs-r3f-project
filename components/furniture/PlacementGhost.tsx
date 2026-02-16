'use client'

import { Suspense, useRef, useMemo, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { useItemLibrary } from '@/lib/item-library-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import { useWallMesh } from '@/lib/contexts/wall-mesh-context'
import * as THREE from 'three'
import { ParametricShape, PlacementType } from '@/types/room'

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
      // Floor placement - raycast to floor plane (Y=0)
      const intersectionPoint = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(floorPlane.current, intersectionPoint)) {
        newPosition = {
          x: intersectionPoint.x,
          y: 0,
          z: intersectionPoint.z
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
          const wallSide = wallMesh.userData.wallSide as string

          // Position slightly in front of wall
          const normal = hit.face?.normal || new THREE.Vector3(0, 0, 1)
          const worldNormal = normal.clone().applyQuaternion(wallMesh.quaternion)

          newPosition = {
            x: hit.point.x + worldNormal.x * 0.1,
            y: hit.point.y,
            z: hit.point.z + worldNormal.z * 0.1
          }

          // Rotate to face outward from wall
          if (wallSide === 'north') {
            newRotation = { x: 0, y: Math.PI, z: 0 }
          } else if (wallSide === 'south') {
            newRotation = { x: 0, y: 0, z: 0 }
          } else if (wallSide === 'east') {
            newRotation = { x: 0, y: -Math.PI / 2, z: 0 }
          } else if (wallSide === 'west') {
            newRotation = { x: 0, y: Math.PI / 2, z: 0 }
          }
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
      // Use the current ref position and rotation for placement
      const instanceId = addInstanceToRoom(currentRoom.id, itemId, positionRef.current)

      // If rotation is set (wall/ceiling placement), update the instance rotation
      if (rotationRef.current.x !== 0 || rotationRef.current.y !== 0 || rotationRef.current.z !== 0) {
        // Small delay to ensure instance is created
        setTimeout(() => {
          updateInstance(instanceId, { rotation: rotationRef.current })
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
  // Create the extruded geometry from the shape points
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
