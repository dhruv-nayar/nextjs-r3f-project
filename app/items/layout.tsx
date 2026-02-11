'use client'

import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { ModelPreview } from '@/components/items/ModelPreview'
import { useItemLibrary } from '@/lib/item-library-context'

function CanvasContent() {
  const params = useParams()
  const itemId = params?.id as string | undefined
  const { getItem } = useItemLibrary()

  // Get current item based on route
  const item = itemId ? getItem(itemId) : null

  if (!item) {
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="gray" />
        </mesh>
      </group>
    )
  }

  return <ModelPreview modelPath={item.modelPath} />
}

function Placeholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-porcelain">
      <div className="text-6xl text-taupe/20">📦</div>
    </div>
  )
}

export default function ItemsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const isDetailPage = !!params?.id

  return (
    <div className="min-h-screen bg-porcelain flex">
      {/* Left: Persistent Canvas - always mounted but hidden on list page */}
      <div
        className={`${isDetailPage ? 'flex-1' : 'w-0'} h-screen sticky top-0 bg-porcelain transition-all duration-300 overflow-hidden`}
      >
        <Suspense fallback={<Placeholder />}>
          <Canvas
            frameloop="always"
            gl={{
              preserveDrawingBuffer: true,
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance'
            }}
            dpr={[1, 2]}
            style={{ background: '#FAF9F6' }}
            onCreated={({ gl }) => {
              gl.setClearColor(0xFAF9F6, 1)
            }}
          >
            <color attach="background" args={['#FAF9F6']} />
            <PerspectiveCamera makeDefault position={[0, 1, 4]} fov={50} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <directionalLight position={[-5, 3, -5]} intensity={0.6} />

            {/* Model changes based on route, Canvas stays mounted */}
            <CanvasContent />
          </Canvas>
        </Suspense>
      </div>

      {/* Right: Page content (metadata, buttons, etc.) */}
      <div className={`${isDetailPage ? 'w-auto' : 'w-full'} h-screen overflow-y-auto transition-all duration-300 bg-porcelain`}>
        {children}
      </div>
    </div>
  )
}
