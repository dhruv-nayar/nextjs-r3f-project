'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { useSelection } from '@/lib/selection-context'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { RoomScene } from "@/components/rooms/RoomScene";
import { RoomNavigation } from "@/components/rooms/RoomNavigation";
import { Controls } from "@/components/Controls";
import { SceneHierarchyPanel } from "@/components/panels/SceneHierarchyPanel";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { WallSegmentPropertiesPanel } from "@/components/panels/WallSegmentPropertiesPanel";
import { Navbar } from "@/components/layout/Navbar";
import { ViewModeIndicator } from "@/components/mobile/ViewModeIndicator";

function HomeContent() {
  const searchParams = useSearchParams()
  const { switchHome } = useHome()
  const { selectFurniture } = useSelection()
  const { canModifyProject, canMoveObjects, canPlaceObjects } = usePermissions()
  const homeId = searchParams.get('homeId')
  const selectInstance = searchParams.get('selectInstance')

  // Determine if we're in view-only mode (mobile)
  const isViewOnly = !canModifyProject && !canMoveObjects && !canPlaceObjects

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
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      {/* Navigation Bar */}
      <Navbar />

      {/* 3D Scene - takes remaining height */}
      <main className="flex-1 w-full bg-porcelain relative overflow-hidden">
        <RoomScene />
      </main>

      {/* UI Overlays */}
      <RoomNavigation />
      <Controls />
      <SceneHierarchyPanel />
      <PropertiesPanel />
      <WallSegmentPropertiesPanel />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen overflow-hidden bg-porcelain flex items-center justify-center">
        <p className="text-taupe/70">Loading...</p>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
