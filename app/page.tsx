'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { useSelection } from '@/lib/selection-context'
import { RoomScene } from "@/components/rooms/RoomScene";
import { RoomNavigation } from "@/components/rooms/RoomNavigation";
import { Controls } from "@/components/Controls";
import { SceneHierarchyPanel } from "@/components/panels/SceneHierarchyPanel";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { Navbar } from "@/components/layout/Navbar";

function HomeContent() {
  const searchParams = useSearchParams()
  const { switchHome } = useHome()
  const { selectFurniture } = useSelection()
  const homeId = searchParams.get('homeId')
  const selectInstance = searchParams.get('selectInstance')

  // Switch to the home specified in the URL query param
  useEffect(() => {
    if (homeId) {
      switchHome(homeId)
    }
  }, [homeId, switchHome])

  // Select the instance specified in the URL query param (for "Back to Project" navigation)
  useEffect(() => {
    if (selectInstance) {
      // Small delay to ensure the home/room data is loaded
      const timeout = setTimeout(() => {
        // We don't have roomId here, so we'll search for it
        selectFurniture(selectInstance, '')
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [selectInstance, selectFurniture])

  return (
    <>
      {/* Navigation Bar */}
      <Navbar />

      {/* 3D Scene */}
      <main className="w-full h-screen bg-porcelain">
        <RoomScene />
      </main>

      {/* UI Overlays */}
      <RoomNavigation />
      <Controls />
      <SceneHierarchyPanel />
      <PropertiesPanel />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-porcelain flex items-center justify-center">
        <p className="text-taupe/70">Loading...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
