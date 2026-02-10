'use client'

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface ModelPreviewProps {
  modelPath: string
}

export function ModelPreview({ modelPath }: ModelPreviewProps) {
  const gltf = useGLTF(modelPath)
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)

  // Center and scale the model on mount and when modelPath changes
  useEffect(() => {
    if (!groupRef.current || !gltf.scene) return

    // Clone the scene for this instance
    const clonedScene = gltf.scene.clone(true)
    modelRef.current = clonedScene

    // Clear any existing children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0])
    }

    // Add the cloned scene
    groupRef.current.add(clonedScene)

    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // Center the model
    clonedScene.position.set(-center.x, -box.min.y, -center.z)

    // Scale to fit in view
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2 / maxDim
    groupRef.current.scale.setScalar(scale)

    // Reset rotation for new model
    groupRef.current.rotation.y = 0
  }, [gltf.scene, modelPath])

  // Rotate the model slowly
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3
    }
  })

  return <group ref={groupRef} />
}
