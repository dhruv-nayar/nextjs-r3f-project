'use client'

import { useFloorplan } from '@/lib/contexts/floorplan-context'
import { MIN_DOOR_CORNER_DISTANCE, ReferenceImage, FloorplanWallHeights } from '@/types/floorplan'
import { useState, useEffect } from 'react'
import { ReferenceImageUpload } from './ReferenceImageUpload'

interface FloorplanSidebarProps {
  onBuild3DModel?: () => void
}

export function FloorplanSidebar({ onBuild3DModel }: FloorplanSidebarProps) {
  const {
    floorplanData,
    selectedRoomId,
    selectedDoorId,
    activeTool,
    setActiveTool,
    canUndo,
    canRedo,
    undo,
    redo,
    getRoom,
    getDoor,
    updateRoom,
    updateDoor,
    deleteRoom,
    deleteDoor,
    setReferenceImage,
    updateReferenceImage
  } = useFloorplan()

  const selectedRoom = selectedRoomId ? getRoom(selectedRoomId) : null
  const selectedDoorInfo = selectedDoorId ? getDoor(selectedDoorId) : null

  return (
    <div className="w-[480px] flex-shrink-0">
      <div className="fixed right-0 top-[68px] bottom-0 w-[480px] p-6 flex flex-col">
        <div className="bg-floral-white rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)] border border-taupe/[0.03] flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Header with Build Button */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-graphite font-heading">Tools</h3>
            {onBuild3DModel && (
              <button
                onClick={onBuild3DModel}
                disabled={!floorplanData || floorplanData.rooms.length === 0}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5"
                title="Build 3D model from floorplan"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Build 3D
              </button>
            )}
          </div>

          {/* Toolbar Controls */}
          <div className="flex flex-col gap-4">

            {/* Tool Buttons */}
            <div className="flex flex-wrap gap-2">
              <ToolButton
                icon="⌖"
                label="Select"
                active={activeTool === 'select'}
                onClick={() => setActiveTool('select')}
              />
              <ToolButton
                icon="▭"
                label="Draw Room"
                active={activeTool === 'drawRoom'}
                onClick={() => setActiveTool('drawRoom')}
              />
              <ToolButton
                icon="⚿"
                label="Place Door"
                active={activeTool === 'placeDoor'}
                onClick={() => setActiveTool('placeDoor')}
              />
              <ToolButton
                icon="🗑"
                label="Delete"
                active={activeTool === 'delete'}
                onClick={() => setActiveTool('delete')}
              />
            </div>

            {/* Undo/Redo */}
            <div className="flex items-center gap-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  canUndo
                    ? 'bg-taupe/10 text-graphite hover:bg-taupe/20'
                    : 'bg-taupe/5 text-taupe/30 cursor-not-allowed'
                }`}
                title="Undo (Cmd+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  canRedo
                    ? 'bg-taupe/10 text-graphite hover:bg-taupe/20'
                    : 'bg-taupe/5 text-taupe/30 cursor-not-allowed'
                }`}
                title="Redo (Cmd+Shift+Z)"
              >
                Redo ↷
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-taupe/10" />

          {/* Properties Panel */}
          <div className="flex-1 overflow-y-auto">
            {selectedRoom && (
              <RoomPropertiesPanel
                room={selectedRoom}
                onUpdate={(updates) => updateRoom(selectedRoom.id, updates)}
                onDelete={() => deleteRoom(selectedRoom.id)}
              />
            )}

            {selectedDoorInfo && (
              <DoorPropertiesPanel
                room={selectedDoorInfo.room}
                door={selectedDoorInfo.door}
                onUpdate={(updates) => updateDoor(selectedDoorInfo.room.id, selectedDoorInfo.door.id, updates)}
                onDelete={() => deleteDoor(selectedDoorInfo.room.id, selectedDoorInfo.door.id)}
              />
            )}

            {!selectedRoom && !selectedDoorInfo && (
              <CanvasPropertiesPanel
                floorplanData={floorplanData}
                onSetReferenceImage={setReferenceImage}
                onUpdateReferenceImage={updateReferenceImage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface RoomPropertiesPanelProps {
  room: any
  onUpdate: (updates: any) => void
  onDelete: () => void
}

function RoomPropertiesPanel({ room, onUpdate, onDelete }: RoomPropertiesPanelProps) {
  const [name, setName] = useState(room.name)
  const [width, setWidth] = useState(room.width)
  const [height, setHeight] = useState(room.height)
  const [wallHeight, setWallHeight] = useState(room.wallHeight)
  const [showWallHeights, setShowWallHeights] = useState(false)
  const [wallHeights, setWallHeights] = useState<FloorplanWallHeights>(room.wallHeights || {})

  // Sync local state with prop changes
  useEffect(() => {
    setName(room.name)
    setWidth(room.width)
    setHeight(room.height)
    setWallHeight(room.wallHeight)
    setWallHeights(room.wallHeights || {})
  }, [room.id, room.name, room.width, room.height, room.wallHeight, room.wallHeights])

  const handleUpdate = () => {
    onUpdate({ name, width, height, wallHeight, wallHeights: Object.keys(wallHeights).length > 0 ? wallHeights : undefined })
  }

  const handleWallHeightChange = (wall: keyof FloorplanWallHeights, value: string) => {
    const numValue = parseFloat(value)
    if (value === '' || isNaN(numValue)) {
      // Remove the override
      const newWallHeights = { ...wallHeights }
      delete newWallHeights[wall]
      setWallHeights(newWallHeights)
    } else {
      setWallHeights({ ...wallHeights, [wall]: numValue })
    }
  }

  const hasAnyWallHeightOverride = Object.keys(wallHeights).length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Room Properties</h3>
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dimensions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="3"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Depth (ft)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="3"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Wall Height */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Wall Height (ft)
          </label>
          <input
            type="number"
            value={wallHeight}
            onChange={(e) => setWallHeight(parseFloat(e.target.value))}
            onBlur={handleUpdate}
            min="6"
            max="15"
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Standard ceiling: 8-10ft</p>
        </div>

        {/* Individual Wall Heights */}
        <div>
          <button
            onClick={() => setShowWallHeights(!showWallHeights)}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 py-2"
          >
            <span className="flex items-center gap-2">
              Individual Wall Heights
              {hasAnyWallHeightOverride && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  {Object.keys(wallHeights).length} custom
                </span>
              )}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showWallHeights ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showWallHeights && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-3">
              <p className="text-xs text-gray-500 mb-2">
                Leave empty to use default height ({wallHeight}ft)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Top/North (ft)</label>
                  <input
                    type="number"
                    value={wallHeights.top ?? ''}
                    onChange={(e) => handleWallHeightChange('top', e.target.value)}
                    onBlur={handleUpdate}
                    placeholder={wallHeight.toString()}
                    min="6"
                    max="15"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bottom/South (ft)</label>
                  <input
                    type="number"
                    value={wallHeights.bottom ?? ''}
                    onChange={(e) => handleWallHeightChange('bottom', e.target.value)}
                    onBlur={handleUpdate}
                    placeholder={wallHeight.toString()}
                    min="6"
                    max="15"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Left/East (ft)</label>
                  <input
                    type="number"
                    value={wallHeights.left ?? ''}
                    onChange={(e) => handleWallHeightChange('left', e.target.value)}
                    onBlur={handleUpdate}
                    placeholder={wallHeight.toString()}
                    min="6"
                    max="15"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Right/West (ft)</label>
                  <input
                    type="number"
                    value={wallHeights.right ?? ''}
                    onChange={(e) => handleWallHeightChange('right', e.target.value)}
                    onBlur={handleUpdate}
                    placeholder={wallHeight.toString()}
                    min="6"
                    max="15"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {hasAnyWallHeightOverride && (
                <button
                  onClick={() => {
                    setWallHeights({})
                    setTimeout(handleUpdate, 0)
                  }}
                  className="w-full mt-2 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Reset all to default
                </button>
              )}
            </div>
          )}
        </div>

        {/* Doors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Doors
          </label>
          {room.doors.length === 0 ? (
            <p className="text-sm text-gray-500">No doors. Use the "Place Door" tool.</p>
          ) : (
            <div className="space-y-2">
              {room.doors.map((door: any, index: number) => (
                <div key={door.id} className="text-sm bg-gray-50 p-2 rounded">
                  Door {index + 1}: {door.wallSide} wall, {door.width}ft × {door.height}ft
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DoorPropertiesPanelProps {
  room: any
  door: any
  onUpdate: (updates: any) => void
  onDelete: () => void
}

function DoorPropertiesPanel({ room, door, onUpdate, onDelete }: DoorPropertiesPanelProps) {
  const [width, setWidth] = useState(door.width)
  const [height, setHeight] = useState(door.height)
  const [position, setPosition] = useState(door.position)

  // Sync local state with prop changes
  useEffect(() => {
    setWidth(door.width)
    setHeight(door.height)
    setPosition(door.position)
  }, [door.id, door.width, door.height, door.position])

  const handleUpdate = () => {
    console.log('[DoorPropertiesPanel] handleUpdate called:', { width, height, position })
    onUpdate({ width, height, position })
  }

  const wallLength = door.wallSide === 'top' || door.wallSide === 'bottom'
    ? room.width
    : room.height

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Door Properties</h3>
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </div>

      <div className="space-y-4">
        {/* Wall */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wall
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 capitalize">
            {door.wallSide} wall ({wallLength.toFixed(1)}ft long)
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Position from wall start (ft)
          </label>
          <input
            type="number"
            value={position}
            onChange={(e) => setPosition(parseFloat(e.target.value))}
            onBlur={handleUpdate}
            min={MIN_DOOR_CORNER_DISTANCE}
            max={wallLength - width - MIN_DOOR_CORNER_DISTANCE}
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Left edge of {width}ft door. Range: {MIN_DOOR_CORNER_DISTANCE.toFixed(1)} - {(wallLength - width - MIN_DOOR_CORNER_DISTANCE).toFixed(1)}ft
          </p>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Door Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="2"
                max="6"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height (ft)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="6"
                max="8"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Standard: 3ft × 7ft</p>
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
}

function ToolButton({ icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors font-body
        ${active
          ? 'bg-blue-100 text-blue-700 border border-blue-300'
          : 'bg-white text-taupe/80 border border-taupe/10 hover:bg-taupe/5'
        }
      `}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

interface CanvasPropertiesPanelProps {
  floorplanData: any
  onSetReferenceImage: (image: ReferenceImage | undefined) => void
  onUpdateReferenceImage: (updates: Partial<ReferenceImage>) => void
}

function CanvasPropertiesPanel({
  floorplanData,
  onSetReferenceImage,
  onUpdateReferenceImage
}: CanvasPropertiesPanelProps) {
  const referenceImage = floorplanData?.referenceImage

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Floorplan Info</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Canvas Size
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
            {floorplanData?.canvasWidth || 50}ft × {floorplanData?.canvasHeight || 50}ft
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rooms
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
            {floorplanData?.rooms.length || 0} room(s)
          </div>
        </div>

        {/* Reference Image Section */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Reference Image</h4>

          {referenceImage ? (
            <div className="space-y-3">
              {/* Preview thumbnail */}
              <div className="bg-white/50 rounded-lg p-2 border border-taupe/10">
                <img
                  src={referenceImage.url}
                  alt="Reference"
                  className="max-w-full h-auto max-h-20 mx-auto rounded opacity-70"
                />
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Visible</label>
                <button
                  onClick={() => onUpdateReferenceImage({
                    opacity: referenceImage.opacity > 0 ? 0 : 0.5
                  })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    referenceImage.opacity > 0 ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      referenceImage.opacity > 0 ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Opacity slider */}
              {referenceImage.opacity > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-600">Opacity</label>
                    <span className="text-xs text-gray-500">{Math.round(referenceImage.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={referenceImage.opacity}
                    onChange={(e) => onUpdateReferenceImage({ opacity: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              )}

              {/* Scale input */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Scale</label>
                <input
                  type="number"
                  value={referenceImage.scale}
                  onChange={(e) => onUpdateReferenceImage({ scale: parseFloat(e.target.value) || 1 })}
                  min="0.1"
                  max="5"
                  step="0.1"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Rotation input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-600">Rotation</label>
                  <span className="text-xs text-gray-500">{Math.round(referenceImage.rotation || 0)}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={referenceImage.rotation || 0}
                  onChange={(e) => onUpdateReferenceImage({ rotation: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between mt-1">
                  <button
                    onClick={() => onUpdateReferenceImage({ rotation: (referenceImage.rotation || 0) - 90 })}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    -90°
                  </button>
                  <button
                    onClick={() => onUpdateReferenceImage({ rotation: 0 })}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => onUpdateReferenceImage({ rotation: (referenceImage.rotation || 0) + 90 })}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    +90°
                  </button>
                </div>
              </div>

              {/* Lock toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-600">Lock Position</label>
                <button
                  onClick={() => onUpdateReferenceImage({ locked: !referenceImage.locked })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    referenceImage.locked ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      referenceImage.locked ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Remove button */}
              <button
                onClick={() => onSetReferenceImage(undefined)}
                className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
              >
                Remove Image
              </button>
            </div>
          ) : (
            <ReferenceImageUpload onUpload={onSetReferenceImage} />
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Use <strong>Draw Room</strong> to create rectangles</li>
            <li>• Use <strong>Place Door</strong> to click on walls</li>
            <li>• Use <strong>Select</strong> to move/resize rooms</li>
            <li>• Press <strong>Delete</strong> to remove selections</li>
            <li>• Use <strong>Cmd+Z/Y</strong> to undo/redo</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
