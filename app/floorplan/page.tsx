'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { FloorplanProvider, useFloorplan } from '@/lib/contexts/floorplan-context'
import { FloorplanToolbar } from '@/components/floorplan/FloorplanToolbar'
import { FloorplanCanvas } from '@/components/floorplan/FloorplanCanvas'
import { FloorplanSidebar } from '@/components/floorplan/FloorplanSidebar'
import { convert3DToFloorplan } from '@/lib/floorplan/floorplan-converter'

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
  const { homes, getFloorplanData, setFloorplanData } = useHome()
  const { initializeFloorplan } = useFloorplan()

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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <FloorplanToolbar />

      {/* Main content: Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            <FloorplanCanvas width={800} height={600} />
          </div>
        </div>

        {/* Sidebar */}
        <FloorplanSidebar />
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
