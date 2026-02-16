'use client'

import { Suspense, useRef, useMemo, useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree, ThreeEvent } from '@react-three/fiber'
import { useItemLibrary } from '@/lib/item-library-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import * as THREE from 'three'

interface PlacementGhostProps {
  itemId: string
  position: { x: number; y: number; z: number }
}

function GhostModel({ itemId }: { itemId: string }) {
  const { getItem } = useItemLibrary()
  const { confirmPlacement, cancelPlacement } = useInteractionMode()
  const { currentRoom } = useRoom()
  const { addInstanceToRoom } = useHome()
  const { camera } = useThree()
  const item = getItem(itemId)
  const groupRef = useRef<THREE.Group>(null)
  const floorPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  // Use local state for real-time position updates (not context)
  const [localPosition, setLocalPosition] = useState({ x: 0, y: 0, z: 0 })
  const positionRef = useRef({ x: 0, y: 0, z: 0 })

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

    const intersectionPoint = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(floorPlane.current, intersectionPoint)) {
      // Update ref directly for immediate visual feedback
      positionRef.current = {
        x: intersectionPoint.x,
        y: 0,
        z: intersectionPoint.z
      }

      // Update the group position directly (bypasses React state)
      if (groupRef.current) {
        groupRef.current.position.set(intersectionPoint.x, 0, intersectionPoint.z)
      }
    }
  })

  // Handle click to place
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()

    if (currentRoom) {
      // Use the current ref position for placement
      addInstanceToRoom(currentRoom.id, itemId, positionRef.current)
    }
    cancelPlacement() // This exits placement mode
  }

  // Skip rendering model if item not found or no model path
  if (!item || !item.modelPath || item.modelPath === 'placeholder') {
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

  return (
    <GhostModelWithAsset
      itemId={itemId}
      item={item}
      handleClick={handleClick}
      groupRef={groupRef}
    />
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
  const { scene } = useGLTF(item.modelPath)
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

    clonedScene.traverse((child) => {
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
