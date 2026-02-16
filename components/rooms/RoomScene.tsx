'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { useControls } from '@/lib/controls-context'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import { useSelection } from '@/lib/selection-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useInteractionMode } from '@/lib/interaction-mode-context'
import type CameraControlsImpl from 'camera-controls'
import { Floorplan } from '../floorplan/Floorplan'
import { Furniture, ItemInstanceRenderer } from '../furniture/FurnitureLibrary'
import { PlacementGhost } from '../furniture/PlacementGhost'
import { Room } from './Room'
import { SharedWall } from './SharedWall'
import { SCALE } from '@/lib/constants'
import { WallMeshProvider } from '@/lib/contexts/wall-mesh-context'
import { ProjectThumbnailCapture } from '../homes/ProjectThumbnailCapture'

export function RoomScene() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { setControls } = useControls()
  const { currentRoom, rooms, deleteInstance } = useRoom()
  const { currentHome } = useHome()
  const { clearSelection, selection } = useSelection()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { mode, setMode, isDraggingObject, isPlacing, placementState } = useInteractionMode()
  const [spaceHeld, setSpaceHeld] = useState(false)

  // Combined clear function that clears both selection systems
  const clearAllSelections = useCallback(() => {
    clearSelection()
    setSelectedFurnitureId(null)
  }, [clearSelection, setSelectedFurnitureId])

  // Delete selected furniture
  const deleteSelectedFurniture = useCallback(() => {
    // Check both selection systems for selected furniture
    const instanceId = selectedFurnitureId ||
      (selection && 'instanceId' in selection ? selection.instanceId : null)

    if (instanceId) {
      deleteInstance(instanceId)
      clearAllSelections()
    }
  }, [selectedFurnitureId, selection, deleteInstance, clearAllSelections])

  // Space key handler for Figma-style camera pan + Escape to deselect + Delete to remove
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Escape key clears all selections
      if (e.code === 'Escape') {
        e.preventDefault()
        clearAllSelections()
        return
      }

      // Delete or Backspace removes selected furniture
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault()
        deleteSelectedFurniture()
        return
      }

      if (e.code === 'Space' && !e.repeat && mode === 'idle') {
        e.preventDefault() // Prevent page scroll
        setSpaceHeld(true)
        setMode('camera')
        document.body.style.cursor = 'grab'
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceHeld(false)
        if (mode === 'camera') {
          setMode('idle')
        }
        document.body.style.cursor = 'default'
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [mode, setMode, clearAllSelections, deleteSelectedFurniture])

  // Update cursor when in camera mode and dragging
  useEffect(() => {
    if (spaceHeld) {
      const handleMouseDown = () => {
        document.body.style.cursor = 'grabbing'
      }
      const handleMouseUp = () => {
        document.body.style.cursor = spaceHeld ? 'grab' : 'default'
      }
      window.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousedown', handleMouseDown)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [spaceHeld])

  // Memoize camera position based on room ID only - prevents re-render from resetting camera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedCameraPosition = useMemo<[number, number, number]>(() => {
    if (!currentRoom) return [0, 15, 20]
    return [
      currentRoom.cameraPosition.x,
      currentRoom.cameraPosition.y,
      currentRoom.cameraPosition.z
    ]
  }, [currentRoom?.id]) // Only recompute when room ID changes

  // Track previous room ID for camera animation
  const prevRoomIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!controlsRef.current || !currentRoom) return

    // Always set controls reference
    setControls(controlsRef.current)

    // Only animate camera if room actually changed (not just property updates)
    if (prevRoomIdRef.current !== currentRoom.id) {
      prevRoomIdRef.current = currentRoom.id

      const timer = setTimeout(() => {
        if (controlsRef.current) {
          controlsRef.current.setPosition(
            currentRoom.cameraPosition.x,
            currentRoom.cameraPosition.y,
            currentRoom.cameraPosition.z,
            true
          )
          controlsRef.current.setTarget(
            currentRoom.cameraTarget.x,
            currentRoom.cameraTarget.y,
            currentRoom.cameraTarget.z,
            true
          )
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [setControls, currentRoom])

  // Camera is ONLY fully enabled when Space is held
  // No mouse interactions with camera otherwise (scroll zoom handled via effect)
  const cameraEnabled = spaceHeld && !isDraggingObject && !isPlacing

  // Handle scroll wheel zoom when camera is not in full control mode
  useEffect(() => {
    if (!controlsRef.current) return
    if (cameraEnabled) return // Let CameraControls handle it when Space is held

    const handleWheel = (e: WheelEvent) => {
      if (isDraggingObject || isPlacing) return
      e.preventDefault()

      const zoomSpeed = 0.001
      const delta = e.deltaY * zoomSpeed
      controlsRef.current?.dolly(-delta * 10, true)
    }

    const canvas = document.querySelector('canvas')
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
      return () => canvas.removeEventListener('wheel', handleWheel)
    }
  }, [cameraEnabled, isDraggingObject, isPlacing])

  if (!currentRoom) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        No room selected
      </div>
    )
  }

  // Define room positions, dimensions, and doors based on Unit 4A floorplan
  // (For backwards compatibility with example home)
  const roomConfigs = [
    {
      id: 'terrace',
      width: 18,      // 18'-0"
      depth: 11.5,    // 11'-6"
      height: 10,
      position: [0, 0, 17.25] as [number, number, number],  // Positioned at top (north)
      doors: [{ wall: 'south' as const, position: 0, width: 3, height: 7 }]
    },
    {
      id: 'living-dining',
      width: 21.42,   // 21'-5"
      depth: 11.5,    // 11'-6"
      height: 10,
      position: [0, 0, 0] as [number, number, number],  // Center position
      doors: [
        { wall: 'north' as const, position: 0, width: 3, height: 7 },
        { wall: 'south' as const, position: 0.2, width: 3, height: 7 }
      ]
    },
    {
      id: 'bedroom',
      width: 15.58,   // 15'-7"
      depth: 8.5,     // 8'-6"
      height: 10,
      position: [0, 0, -10] as [number, number, number],  // Positioned at bottom (south)
      doors: [{ wall: 'north' as const, position: 0.2, width: 3, height: 7 }]
    }
  ]

  return (
    <WallMeshProvider>
    <Canvas
      shadows
      style={{ background: '#FAF9F6' }}
      onPointerMissed={() => clearAllSelections()}
    >
      <color attach="background" args={['#FAF9F6']} />

      <PerspectiveCamera
        makeDefault
        position={memoizedCameraPosition}
        fov={75}
      />

      <CameraControls
        ref={controlsRef}
        enabled={cameraEnabled}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        minDistance={SCALE.CAMERA.MIN_DISTANCE}
        maxDistance={SCALE.CAMERA.MAX_DISTANCE}
        dollySpeed={1}
        truckSpeed={2}
        azimuthRotateSpeed={1}
        polarRotateSpeed={1}
      />

      {/* Lighting */}
      <ambientLight intensity={currentRoom.lighting?.ambient.intensity || Math.PI / 2} />
      <directionalLight
        position={[10, 25, 15]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={30}
        shadow-camera-bottom={-15}
      />

      {/* Rooms and Furniture */}
      {rooms.map((room) => {
        // NEW: Support floorplan-generated rooms
        // Use room.dimensions and room.position if available (from floorplan)
        // Otherwise fall back to hardcoded configs
        const roomConfig = roomConfigs.find(rc => rc.id === room.id)

        const roomPosition = room.position || roomConfig?.position || [0, 0, 0]
        const roomDoors = room.doors || roomConfig?.doors || []
        const roomWidth = room.dimensions?.width || roomConfig?.width || 20
        const roomDepth = room.dimensions?.depth || roomConfig?.depth || 20
        const roomHeight = room.dimensions?.height || roomConfig?.height || 10

        return (
          <group key={room.id}>
            {/* Room */}
            {room.floorplan ? (
              <Floorplan config={room.floorplan} />
            ) : (
              <Room
                width={roomWidth}
                height={roomHeight}
                depth={roomDepth}
                position={roomPosition}
                doors={roomDoors}
                roomId={room.id}
                excludedWalls={room.excludedWalls}
                wallHeights={room.wallHeights}
                gridSettings={room.gridSettings}
              />
            )}

            {/* Furniture in this room (OLD: legacy furniture items) */}
            {room.furniture?.map((item) => (
              <group key={item.id} position={roomPosition}>
                <Furniture item={item} />
              </group>
            ))}

            {/* Instances in this room (NEW: item instances) */}
            {room.instances?.map((instance) => (
              <group key={instance.id} position={roomPosition}>
                <ItemInstanceRenderer instance={instance} />
              </group>
            ))}
          </group>
        )
      })}

      {/* Shared Walls - renders walls between adjacent rooms */}
      {currentHome?.sharedWalls?.map(wall => (
        <SharedWall key={wall.id} wall={wall} />
      ))}

      {/* Placement Ghost - shows preview when adding new item */}
      {isPlacing && placementState.itemId && (
        <PlacementGhost
          itemId={placementState.itemId}
          position={placementState.previewPosition}
        />
      )}

      {/* Environment */}
      <Environment preset="city" />

      {/* Auto-capture thumbnail for project */}
      {currentHome && (
        <ProjectThumbnailCapture homeId={currentHome.id} />
      )}
    </Canvas>
    </WallMeshProvider>
  )
}
