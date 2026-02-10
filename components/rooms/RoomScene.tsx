'use client'

import { useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, PerspectiveCamera, Environment, Grid } from '@react-three/drei'
import { useControls } from '@/lib/controls-context'
import { useRoom } from '@/lib/room-context'
import type CameraControlsImpl from 'camera-controls'
import { Floorplan } from '../floorplan/Floorplan'
import { Furniture, ItemInstanceRenderer } from '../furniture/FurnitureLibrary'
import { Room } from './Room'
import { GRID, SCALE } from '@/lib/constants'

export function RoomScene() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { setControls } = useControls()
  const { currentRoom, rooms } = useRoom()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (controlsRef.current) {
        setControls(controlsRef.current)

        // Animate camera to room position
        if (currentRoom) {
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
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [setControls, currentRoom])

  if (!currentRoom) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        No room selected
      </div>
    )
  }

  // Define room positions, dimensions, and doors based on Unit 4A floorplan
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
    <Canvas shadows>
      <PerspectiveCamera
        makeDefault
        position={[
          currentRoom.cameraPosition.x,
          currentRoom.cameraPosition.y,
          currentRoom.cameraPosition.z
        ]}
        fov={75}
      />

      <CameraControls
        ref={controlsRef}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2}
        minDistance={SCALE.CAMERA.MIN_DISTANCE}
        maxDistance={SCALE.CAMERA.MAX_DISTANCE}
        dollySpeed={1}
        truckSpeed={2}
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
        const roomConfig = roomConfigs.find(rc => rc.id === room.id)
        const roomPosition = roomConfig?.position || [0, 0, 0]
        const roomDoors = roomConfig?.doors || []
        const roomWidth = roomConfig?.width || 20
        const roomDepth = roomConfig?.depth || 20
        const roomHeight = roomConfig?.height || 10

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

      {/* Environment */}
      <Environment preset="city" />
    </Canvas>
  )
}
