'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { FloorplanCanvasV2, FloorplanV2Data } from '@/components/floorplan/FloorplanCanvasV2'
import { FloorplanDataV2, CANVAS_WIDTH, CANVAS_HEIGHT, PIXELS_PER_FOOT } from '@/types/floorplan-v2'
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

  return <FloorplanV2PageWrapper homeId={homeId} />
}

function FloorplanV2PageWrapper({ homeId }: { homeId: string }) {
  const router = useRouter()
  const {
    homes,
    currentHome,
    getFloorplanDataV2,
    setFloorplanDataV2,
    buildRoomsFromFloorplanV2,
    switchHome
  } = useHome()

  const [floorplanData, setFloorplanData] = useState<FloorplanV2Data | null>(null)
  const [isBuilding, setIsBuilding] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Find the home
  const home = homes.find(h => h.id === homeId)

  // Load existing V2 floorplan data
  useEffect(() => {
    if (!home) {
      router.push('/homes')
      return
    }

    const existingV2Data = getFloorplanDataV2(homeId)
    if (existingV2Data) {
      setFloorplanData({
        vertices: existingV2Data.vertices,
        walls: existingV2Data.walls,
        rooms: existingV2Data.rooms,
      })
    }
  }, [homeId, home, getFloorplanDataV2, router])

  // Handle data changes from canvas
  const handleDataChange = useCallback((data: FloorplanV2Data) => {
    setFloorplanData(data)
    setHasUnsavedChanges(true)
  }, [])

  // Save floorplan data
  const handleSave = useCallback(() => {
    if (!floorplanData) return

    const dataToSave: FloorplanDataV2 = {
      vertices: floorplanData.vertices,
      walls: floorplanData.walls,
      rooms: floorplanData.rooms,
      canvasWidth: CANVAS_WIDTH,
      canvasHeight: CANVAS_HEIGHT,
      pixelsPerFoot: PIXELS_PER_FOOT,
      createdAt: getFloorplanDataV2(homeId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setFloorplanDataV2(homeId, dataToSave)
    setHasUnsavedChanges(false)
  }, [floorplanData, homeId, getFloorplanDataV2, setFloorplanDataV2])

  // Build 3D model
  const handleBuild3D = useCallback(async () => {
    if (!floorplanData || floorplanData.rooms.length === 0) {
      alert('Please draw at least one room before building the 3D model.')
      return
    }

    setIsBuilding(true)

    try {
      // Save the floorplan data first
      const dataToSave: FloorplanDataV2 = {
        vertices: floorplanData.vertices,
        walls: floorplanData.walls,
        rooms: floorplanData.rooms,
        canvasWidth: CANVAS_WIDTH,
        canvasHeight: CANVAS_HEIGHT,
        pixelsPerFoot: PIXELS_PER_FOOT,
        createdAt: getFloorplanDataV2(homeId)?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Build 3D rooms from V2 floorplan
      buildRoomsFromFloorplanV2(homeId, dataToSave)

      // Switch to this home and navigate to 3D view
      switchHome(homeId)
      setHasUnsavedChanges(false)

      // Small delay to allow state to update
      setTimeout(() => {
        router.push('/')
      }, 100)
    } catch (error) {
      console.error('Error building 3D model:', error)
      alert('Error building 3D model. Check the console for details.')
    } finally {
      setIsBuilding(false)
    }
  }, [floorplanData, homeId, getFloorplanDataV2, buildRoomsFromFloorplanV2, switchHome, router])

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Save before leaving?')) {
        handleSave()
      }
    }
    router.push('/')
  }, [hasUnsavedChanges, handleSave, router])

  const roomCount = floorplanData?.rooms.length || 0
  const initialData = floorplanData ? {
    vertices: floorplanData.vertices,
    walls: floorplanData.walls,
    rooms: floorplanData.rooms,
  } : undefined

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Navigation Bar */}
      <Navbar />

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-lg font-semibold text-gray-900">
            Floorplan Editor
            {home && <span className="text-gray-500 font-normal ml-2">- {home.name}</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-sm text-amber-600">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              hasUnsavedChanges
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save
          </button>
          <button
            onClick={handleBuild3D}
            disabled={roomCount === 0 || isBuilding}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              roomCount > 0 && !isBuilding
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isBuilding ? 'Building...' : `Build 3D Model (${roomCount} ${roomCount === 1 ? 'room' : 'rooms'})`}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl">
            <FloorplanCanvasV2
              initialData={initialData}
              onChange={handleDataChange}
            />
          </div>
        </div>

        {/* Sidebar with tools */}
        <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-y-auto">
          <h2 className="font-semibold text-gray-900 mb-4">Tools</h2>

          {/* Tools will be injected here by FloorplanCanvasV2 */}
          <div id="floorplan-toolbar-container" className="mb-6"></div>

          <h2 className="font-semibold text-gray-900 mb-4 mt-8">How to Draw</h2>

          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-800 mb-1">Creating Rooms</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Click to place corner points</li>
                <li>Click back on a vertex to close the shape</li>
                <li>Closed shapes become rooms</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 mb-1">Shared Walls</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Click existing vertex to share corners</li>
                <li>Click on a wall to split it</li>
                <li>Connected rooms update together</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 mb-1">Editing</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Drag vertices to move them</li>
                <li>Press Delete to remove vertex</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 mb-1">Keyboard</h3>
              <ul className="space-y-1">
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Shift</kbd> - Snap to 45°</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Escape</kbd> - Cancel drawing</li>
                <li><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">Delete</kbd> - Remove vertex</li>
              </ul>
            </div>
          </div>

          {/* Room list */}
          {floorplanData && floorplanData.rooms.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-3">Rooms ({floorplanData.rooms.length})</h2>
              <div className="space-y-2">
                {floorplanData.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: room.color }}
                    />
                    <span className="text-gray-800">{room.name}</span>
                    <span className="text-gray-400 text-xs">
                      ({room.wallIds.length} walls)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
