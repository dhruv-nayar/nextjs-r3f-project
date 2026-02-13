'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { FloorplanProvider, useFloorplan } from '@/lib/contexts/floorplan-context'
import { FloorplanCanvas } from '@/components/floorplan/FloorplanCanvas'
import { FloorplanSidebar } from '@/components/floorplan/FloorplanSidebar'
import { convert3DToFloorplan } from '@/lib/floorplan/floorplan-converter'
import { Navbar } from '@/components/layout/Navbar'

function FloorplanPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const homeId = searchParams.get('homeId')

  // Redirect if no homeId
  useEffect(() => {
    if (!homeId) {
      router.push('/homes')
    }
  }, [homeId, router])

  if (!homeId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <FloorplanProvider>
      <FloorplanPageWrapper homeId={homeId} />
    </FloorplanProvider>
  )
}

function FloorplanPageWrapper({ homeId }: { homeId: string }) {
  const router = useRouter()
  const { homes, getFloorplanData, setFloorplanData, buildRoomsFromFloorplan, switchHome } = useHome()
  const { initializeFloorplan, floorplanData, build3DModel } = useFloorplan()

  // Initialize floorplan data
  useEffect(() => {
    const home = homes.find(h => h.id === homeId)
    if (!home) {
      router.push('/homes')
      return
    }

    // Get existing floorplan data
    let existingData = getFloorplanData(homeId)

    // If no floorplan data but home has 3D rooms, convert them to 2D
    if (!existingData && home.rooms && home.rooms.length > 0) {
      existingData = convert3DToFloorplan(homeId, home.rooms)
      // Save the converted floorplan data
      setFloorplanData(homeId, existingData)
    }

    // Initialize floorplan context
    initializeFloorplan(homeId, existingData)
  }, [homeId, homes, getFloorplanData, setFloorplanData, initializeFloorplan, router])

  const handleBuild3D = () => {
    if (!floorplanData) return

    const result = build3DModel()

    if (!result) {
      console.error('No floorplan data available')
      return
    }

    if (result.errors.length > 0) {
      console.error('Floorplan validation errors:', result.errors)
      return
    }

    // Build 3D rooms from floorplan
    buildRoomsFromFloorplan(floorplanData.homeId, floorplanData)

    // Switch to this home and redirect to 3D editor
    switchHome(floorplanData.homeId)
    setTimeout(() => {
      router.push(`/?homeId=${floorplanData.homeId}`)
    }, 500)
  }

  return (
    <div className="h-screen flex flex-col bg-porcelain">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main content: Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-porcelain rounded-lg border border-gray-200">
            <FloorplanCanvas width={800} height={600} />
          </div>
        </div>

        {/* Sidebar */}
        <FloorplanSidebar onBuild3DModel={handleBuild3D} />
      </div>
    </div>
  )
}

export default function FloorplanPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading floorplan editor...</p>
      </div>
    }>
      <FloorplanPageContent />
    </Suspense>
  )
}
