'use client'

import { useFloorplan } from '@/lib/contexts/floorplan-context'
import { useHome } from '@/lib/home-context'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function FloorplanToolbar() {
  const router = useRouter()
  const {
    activeTool,
    setActiveTool,
    canUndo,
    canRedo,
    undo,
    redo,
    floorplanData,
    build3DModel
  } = useFloorplan()

  const { buildRoomsFromFloorplan } = useHome()
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBuild3D = () => {
    if (!floorplanData) return

    setIsBuilding(true)
    setError(null)

    const result = build3DModel()

    if (!result) {
      setError('No floorplan data available')
      setIsBuilding(false)
      return
    }

    if (result.errors.length > 0) {
      setError(result.errors.join(', '))
      setIsBuilding(false)
      return
    }

    // Build 3D rooms from floorplan
    buildRoomsFromFloorplan(floorplanData.homeId, floorplanData)

    // Redirect to 3D editor
    setTimeout(() => {
      router.push(`/?homeId=${floorplanData.homeId}`)
    }, 500)
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Tools */}
        <div className="flex items-center gap-2">
          <ToolButton
            icon="⌖"
            label="Select"
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            tooltip="Select and move rooms (S)"
          />
          <ToolButton
            icon="▭"
            label="Draw Room"
            active={activeTool === 'drawRoom'}
            onClick={() => setActiveTool('drawRoom')}
            tooltip="Click and drag to draw a room (R)"
          />
          <ToolButton
            icon="⚿"
            label="Place Door"
            active={activeTool === 'placeDoor'}
            onClick={() => setActiveTool('placeDoor')}
            tooltip="Click on a wall to place a door (D)"
          />
          <ToolButton
            icon="🗑"
            label="Delete"
            active={activeTool === 'delete'}
            onClick={() => setActiveTool('delete')}
            tooltip="Delete selected room or door (Del)"
          />

          <div className="w-px h-6 bg-gray-300 mx-2" />

          {/* History */}
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Undo (Cmd+Z)"
          >
            <span className="text-lg">↶</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Redo (Cmd+Shift+Z)"
          >
            <span className="text-lg">↷</span>
          </button>
        </div>

        {/* Center: Title */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Floorplan Editor</h2>
          <p className="text-xs text-gray-500">Draw rooms, place doors, build 3D</p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="text-sm text-red-600 mr-4 max-w-xs truncate" title={error}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleBuild3D}
            disabled={isBuilding || !floorplanData || floorplanData.rooms.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isBuilding ? 'Building...' : 'Build 3D Model'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToolButtonProps {
  icon: string
  label: string
  active: boolean
  onClick: () => void
  tooltip?: string
}

function ToolButton({ icon, label, active, onClick, tooltip }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`
        flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors
        ${active
          ? 'bg-blue-100 text-blue-700 border border-blue-300'
          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
