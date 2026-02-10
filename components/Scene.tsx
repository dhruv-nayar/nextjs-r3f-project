'use client'

import { useRef, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Fisheye, CameraControls, PerspectiveCamera, Environment } from '@react-three/drei'
import { Level, Sudo, Camera, Cactus, Box } from './SceneObjects'
import { useControls } from '@/lib/controls-context'
import type CameraControlsImpl from 'camera-controls'

export function Scene() {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const { setControls } = useControls()

  useEffect(() => {
    // Set controls after a short delay to ensure they're initialized
    const timer = setTimeout(() => {
      if (controlsRef.current) {
        console.log('Setting controls from Scene:', controlsRef.current)
        setControls(controlsRef.current)
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [setControls])

  return (
    <Canvas flat>
      <Fisheye zoom={0}>
        <CameraControls
          ref={controlsRef}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 1.6}
          dollySpeed={1}
          truckSpeed={2}
        />
        <ambientLight intensity={Math.PI / 2} />
        <group scale={20} position={[5, -11, -5]}>
          <Level />
          <Sudo />
          <Camera />
          <Cactus />
          <Box position={[-0.8, 1.4, 0.4]} scale={0.15} />
        </group>
        <Environment preset="city" background blur={1} />
        <PerspectiveCamera makeDefault position={[0, 0, 18.5]} />
      </Fisheye>
    </Canvas>
  )
}
