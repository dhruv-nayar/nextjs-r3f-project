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
import { Furniture, ItemInstanceRenderer } from '../furniture/FurnitureLibrary'
import { PlacementGhost } from '../furniture/PlacementGhost'
import { Room } from './Room'
import { PolygonRoom } from './PolygonRoom'
import { PolygonRoomFloor } from './PolygonRoomFloor'
import { SharedWall } from './SharedWall'
import { WallSegmentRenderer } from './WallSegmentRenderer'
import { SCALE } from '@/lib/constants'
import { WallMeshProvider } from '@/lib/contexts/wall-mesh-context'
import { SurfaceMeshProvider } from '@/lib/contexts/surface-mesh-context'
import { ProjectThumbnailCapture } from '../homes/ProjectThumbnailCapture'
import { useWallSegments } from '@/lib/use-wall-segments'
import { useMobile } from '@/lib/mobile-context'
import { usePermissions } from '@/lib/hooks/use-permissions'

export function RoomScene() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { setControls } = useControls()
  const { currentRoom, rooms, deleteInstance, copyInstance, pasteInstance } = useRoom()
  const { currentHome } = useHome()
  const { clearSelection, selection } = useSelection()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { mode, setMode, isDraggingObject, isPlacing, placementState } = useInteractionMode()
  const [spaceHeld, setSpaceHeld] = useState(false)
  const { isMobile } = useMobile()
  const { canMoveObjects, canInspectFurniture } = usePermissions()

  // V3 Wall Segments - two-sided wall rendering
  const {
    floorplanV3,
    useV3Rendering,
    selectedSegmentId,
    selectedSide,
    selectWallSide,
    clearWallSelection,
    doorPlacementMode,
    addDoor,
    setDoorPlacementMode,
  } = useWallSegments()

  // Log doorPlacementMode changes
  useEffect(() => {
    console.log('[RoomScene] doorPlacementMode changed:', doorPlacementMode)
  }, [doorPlacementMode])

  // Handle door placement from 3D click
  const handleDoorPlace = useCallback((segmentId: string, clickPosition: number) => {
    // Offset by half door width so door centers on click
    // Default door width is 3ft, so offset by 1.5ft
    const DEFAULT_DOOR_WIDTH = 3
    const doorPosition = Math.max(0, clickPosition - DEFAULT_DOOR_WIDTH / 2)
    console.log('[RoomScene] Door place request:', segmentId, 'click:', clickPosition, 'door position:', doorPosition)

    // Select the segment that received the door (in case it's different from currently selected)
    // This handles the case where overlapping segments exist
    if (segmentId !== selectedSegmentId) {
      console.log('[RoomScene] Switching selection to clicked segment:', segmentId)
      selectWallSide(segmentId, 'A') // Default to side A
    }

    const success = addDoor(segmentId, doorPosition)
    if (success) {
      // Exit door placement mode after successfully placing a door
      setDoorPlacementMode(false)
    }
  }, [addDoor, setDoorPlacementMode, selectedSegmentId, selectWallSide])

  // Combined clear function that clears all selection systems
  const clearAllSelections = useCallback(() => {
    clearSelection()
    setSelectedFurnitureId(null)
    clearWallSelection()
  }, [clearSelection, setSelectedFurnitureId, clearWallSelection])

  // Wrapper for wall segment selection that also clears other selections
  const handleWallSegmentSelect = useCallback((segmentId: string, side: 'A' | 'B') => {
    // Clear general selection so PropertiesPanel hides
    clearSelection()
    setSelectedFurnitureId(null)
    // Then select the wall segment
    selectWallSide(segmentId, side)
  }, [clearSelection, setSelectedFurnitureId, selectWallSide])

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
  // Skip on mobile (no keyboard, touch controls handle camera)
  useEffect(() => {
    if (isMobile) return // No keyboard handlers on mobile

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

      // Delete or Backspace removes selected furniture (only if can modify)
      if ((e.code === 'Delete' || e.code === 'Backspace') && canMoveObjects) {
        e.preventDefault()
        deleteSelectedFurniture()
        return
      }

      // Copy: Cmd/Ctrl + C
      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        const instanceId = selectedFurnitureId ||
          (selection && 'instanceId' in selection ? selection.instanceId : null)
        if (instanceId) {
          e.preventDefault()
          copyInstance(instanceId)
        }
        return
      }

      // Paste: Cmd/Ctrl + V (only if can modify)
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && canMoveObjects) {
        e.preventDefault()
        const newInstanceId = pasteInstance()
        if (newInstanceId) {
          // Select the newly pasted instance
          setSelectedFurnitureId(newInstanceId)
        }
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
  }, [mode, setMode, clearAllSelections, deleteSelectedFurniture, isMobile, canMoveObjects, copyInstance, pasteInstance, selectedFurnitureId, selection, setSelectedFurnitureId])

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

  // Set controls reference - only when controls ref changes
  useEffect(() => {
    if (controlsRef.current) {
      setControls(controlsRef.current)
    }
  }, [setControls])

  // Animate camera ONLY when room ID changes - NOT on property updates
  // Use room ID as sole dependency to prevent re-running on furniture changes
  const currentRoomId = currentRoom?.id

  useEffect(() => {
    if (!controlsRef.current || !currentRoom) return

    // Only animate camera if room actually changed
    if (prevRoomIdRef.current !== currentRoomId) {
      prevRoomIdRef.current = currentRoomId ?? null

      const timer = setTimeout(() => {
        if (controlsRef.current && currentRoom) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId])

  // Camera control logic:
  // - Desktop: Only fully enabled when Space is held
  // - Mobile: Always enabled for touch pan/zoom (no Space key available)
  const cameraEnabled = isMobile || (spaceHeld && !isDraggingObject && !isPlacing)

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
    <SurfaceMeshProvider>
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
            {/* Room rendering:
                - V3 mode (useV3Rendering): Use PolygonRoomFloor for floors, walls rendered separately
                - V2 mode: Use PolygonRoom (includes walls) or Room for rectangles
            */}
            {room.polygon && room.polygon.length >= 3 ? (
              useV3Rendering ? (
                // V3: Floor only - walls rendered via WallSegmentRenderer below
                <PolygonRoomFloor
                  polygon={room.polygon}
                  position={roomPosition}
                  roomId={room.id}
                  gridSettings={room.gridSettings}
                />
              ) : (
                // V2: Full PolygonRoom with walls
                <PolygonRoom
                  polygon={room.polygon}
                  height={roomHeight}
                  position={roomPosition}
                  roomId={room.id}
                  doors={roomDoors}
                />
              )
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

      {/* V3 Wall Segments - two-sided walls with independent styling per side */}
      {useV3Rendering && floorplanV3 && (
        <WallSegmentRenderer
          segments={floorplanV3.wallSegments}
          vertices={floorplanV3.vertices}
          selectedSegmentId={selectedSegmentId}
          selectedSide={selectedSide}
          onSegmentSideClick={handleWallSegmentSelect}
          doorPlacementMode={doorPlacementMode}
          onDoorPlace={handleDoorPlace}
        />
      )}

      {/* Shared Walls - only render when NOT using V3 (V3 absorbs this concept) */}
      {!useV3Rendering && currentHome?.sharedWalls?.map(wall => (
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
    </SurfaceMeshProvider>
  )
}
