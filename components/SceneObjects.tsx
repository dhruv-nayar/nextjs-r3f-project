'use client'

import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshWobbleMaterial, useGLTF } from '@react-three/drei'
import { useSpring, a } from '@react-spring/three'

export function Level() {
  const { nodes } = useGLTF('/level-react-draco.glb') as any
  return <mesh geometry={nodes.Level.geometry} material={nodes.Level.material} position={[-0.38, 0.69, 0.62]} rotation={[Math.PI / 2, -Math.PI / 9, 0]} />
}

export function Sudo() {
  const { nodes } = useGLTF('/level-react-draco.glb') as any
  const [spring, api] = useSpring(() => ({ rotation: [Math.PI / 2, 0, 0.29], config: { friction: 40 } }), [])
  useEffect(() => {
    let timeout: NodeJS.Timeout
    const wander = () => {
      api.start({ rotation: [Math.PI / 2 + THREE.MathUtils.randFloatSpread(2) * 0.3, 0, 0.29 + THREE.MathUtils.randFloatSpread(2) * 0.2] })
      timeout = setTimeout(wander, (1 + Math.random() * 2) * 800)
    }
    wander()
    return () => clearTimeout(timeout)
  }, [api])
  return (
    <>
      <mesh geometry={nodes.Sudo.geometry} material={nodes.Sudo.material} position={[0.68, 0.33, -0.67]} rotation={[Math.PI / 2, 0, 0.29]} />
      <a.mesh geometry={nodes.SudoHead.geometry} material={nodes.SudoHead.material} position={[0.68, 0.33, -0.67]} rotation={spring.rotation as any} />
    </>
  )
}

export function Camera() {
  const { nodes, materials } = useGLTF('/level-react-draco.glb') as any
  const [spring, api] = useSpring(() => ({ 'rotation-z': 0, config: { friction: 40 } }), [])
  useEffect(() => {
    let timeout: NodeJS.Timeout
    const wander = () => {
      api.start({ 'rotation-z': Math.random() })
      timeout = setTimeout(wander, (1 + Math.random() * 2) * 800)
    }
    wander()
    return () => clearTimeout(timeout)
  }, [api])
  return (
    <a.group position={[-0.58, 0.83, -0.03]} rotation={[Math.PI / 2, 0, 0.47]} {...spring}>
      <mesh geometry={nodes.Camera.geometry} material={nodes.Camera.material} />
      <mesh geometry={nodes.Camera_1.geometry} material={materials.Lens} />
    </a.group>
  )
}

export function Cactus() {
  const { nodes, materials } = useGLTF('/level-react-draco.glb') as any
  return (
    <mesh geometry={nodes.Cactus.geometry} position={[-0.42, 0.51, -0.62]} rotation={[Math.PI / 2, 0, 0]}>
      <MeshWobbleMaterial factor={0.4} map={materials.Cactus.map} />
    </mesh>
  )
}

export function Box({ scale = 1, ...props }: { scale?: number; position?: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!)
  const [hovered, hover] = useState(false)
  const [clicked, click] = useState(false)
  useFrame((state, delta) => (ref.current.rotation.x = ref.current.rotation.y += delta))
  return (
    <mesh
      {...props}
      ref={ref}
      scale={(clicked ? 1.5 : 1) * scale}
      onClick={() => click(!clicked)}
      onPointerOver={(event) => (event.stopPropagation(), hover(true))}
      onPointerOut={(event) => hover(false)}>
      <boxGeometry />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

useGLTF.preload('/level-react-draco.glb')
