'use client'

import { useWallSegments } from '@/lib/use-wall-segments'
import { WallSegmentProperties } from './properties/WallSegmentProperties'

/**
 * WallSegmentPropertiesPanel: Floating properties panel for V3 wall segments
 *
 * Shows when a wall segment side is selected in the 3D view.
 * Positioned to the right, alongside other panels.
 */
export function WallSegmentPropertiesPanel() {
  const {
    floorplanV3,
    selectedSegmentId,
    selectedSide,
    clearWallSelection,
    updateWallStyle,
    addDoor,
    removeDoor,
    getSegmentLength,
    doorPlacementMode,
    setDoorPlacementMode,
  } = useWallSegments()

  // Don't render if no V3 data or no selection
  if (!floorplanV3 || !selectedSegmentId || !selectedSide) {
    return null
  }

  // Find the selected segment
  const segment = floorplanV3.wallSegments.find(s => s.id === selectedSegmentId)
  if (!segment) {
    return null
  }

  return (
    <div className="fixed right-6 top-24 bottom-6 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 w-80 overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Wall Properties</h2>
        <button
          onClick={clearWallSelection}
          className="text-white/50 hover:text-white transition-colors p-1"
          title="Close"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <WallSegmentProperties
          segment={segment}
          side={selectedSide}
          rooms={floorplanV3.rooms}
          wallLength={getSegmentLength(selectedSegmentId)}
          onStyleChange={(updates) => {
            updateWallStyle(selectedSegmentId, selectedSide, updates)
          }}
          onAddDoor={(position, width, height) => {
            return addDoor(selectedSegmentId, position, width, height)
          }}
          onRemoveDoor={(doorId) => {
            removeDoor(selectedSegmentId, doorId)
          }}
          doorPlacementMode={doorPlacementMode}
          onSetDoorPlacementMode={setDoorPlacementMode}
        />
      </div>
    </div>
  )
}
