'use client'

import { useTexture } from '@react-three/drei'
import { FloorplanConfig } from '@/types/room'
import { FLOORPLAN } from '@/lib/constants'
import * as THREE from 'three'

interface FloorplanProps {
  config: FloorplanConfig
}

export function Floorplan({ config }: FloorplanProps) {
  const texture = useTexture(config.imagePath)

  // Configure texture
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.flipY = false

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, FLOORPLAN.GROUND_OFFSET, 0]}
      receiveShadow
    >
      <planeGeometry args={[config.widthFeet, config.heightFeet]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={0.9}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
