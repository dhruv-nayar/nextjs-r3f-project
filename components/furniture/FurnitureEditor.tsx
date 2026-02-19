'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'
import { useResizeMode } from '@/lib/resize-mode-context'
import { WallPlacement } from '@/types/room'

type WallSide = 'north' | 'south' | 'east' | 'west'
const WALL_SIDES: WallSide[] = ['north', 'south', 'east', 'west']

export function FurnitureEditor() {
  const router = useRouter()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { rooms, updateFurniture, updateInstance } = useRoom()
  const { getItem, updateItem } = useItemLibrary()
  const { currentHomeId } = useHome()
  const { isResizeMode, setResizeMode } = useResizeMode()

  // Find the selected item - could be old furniture or new instance
  const selectedFurniture = rooms
    .flatMap(room => room.furniture || [])
    .find(item => item?.id === selectedFurnitureId)

  const selectedInstance = rooms
    .flatMap(room => room.instances || [])
    .find(inst => inst?.id === selectedFurnitureId)

  const selectedItem = selectedInstance ? getItem(selectedInstance.itemId) : undefined

  // Use either furniture or instance data
  const selected = selectedFurniture || (selectedInstance && selectedItem ? {
    id: selectedInstance.id,
    name: selectedInstance.customName || selectedItem.name,
    category: selectedItem.category,
    position: selectedInstance.position,
    rotation: selectedInstance.rotation,
    scale: selectedInstance.scaleMultiplier,
    targetDimensions: selectedItem.dimensions,
    isInstance: true,
    // Wall item properties
    isWallItem: selectedItem.placementType === 'wall' || !!selectedInstance.wallPlacement,
    wallPlacement: selectedInstance.wallPlacement,
    roomId: selectedInstance.roomId
  } : undefined)

  const [posX, setPosX] = useState(0)
  const [posY, setPosY] = useState(0)
  const [posZ, setPosZ] = useState(0)
  const [scaleX, setScaleX] = useState(1)
  const [scaleY, setScaleY] = useState(1)
  const [scaleZ, setScaleZ] = useState(1)
  const [showAdvancedScale, setShowAdvancedScale] = useState(false)

  // Dimension state (feet and inches)
  const [widthFeet, setWidthFeet] = useState(0)
  const [widthInches, setWidthInches] = useState(0)
  const [heightFeet, setHeightFeet] = useState(0)
  const [heightInches, setHeightInches] = useState(0)
  const [depthFeet, setDepthFeet] = useState(0)
  const [depthInches, setDepthInches] = useState(0)

  // Wall placement state (for wall-mounted items)
  const [wallHeightFeet, setWallHeightFeet] = useState(0)
  const [wallHeightInches, setWallHeightInches] = useState(0)
  const [lateralOffsetFeet, setLateralOffsetFeet] = useState(0)
  const [lateralOffsetInches, setLateralOffsetInches] = useState(0)
  const [selectedWall, setSelectedWall] = useState<WallSide>('north')

  // Update local state when selection properties change
  useEffect(() => {
    if (selected) {
      setPosX(selected.position.x)
      setPosY(selected.position.y)
      setPosZ(selected.position.z)
      setScaleX(selected.scale.x)
      setScaleY(selected.scale.y)
      setScaleZ(selected.scale.z)

      // Update dimension inputs from targetDimensions
      if (selected.targetDimensions) {
        const { width, height, depth } = selected.targetDimensions
        setWidthFeet(Math.floor(width))
        setWidthInches((width % 1) * 12)
        setHeightFeet(Math.floor(height))
        setHeightInches((height % 1) * 12)
        setDepthFeet(Math.floor(depth))
        setDepthInches((depth % 1) * 12)
      }

      // Update wall placement state for wall-mounted items
      if ('isWallItem' in selected && selected.isWallItem && selected.wallPlacement) {
        const wp = selected.wallPlacement
        setWallHeightFeet(Math.floor(wp.heightFromFloor))
        setWallHeightInches((wp.heightFromFloor % 1) * 12)
        setLateralOffsetFeet(Math.floor(Math.abs(wp.lateralOffset)) * Math.sign(wp.lateralOffset || 1))
        setLateralOffsetInches(((Math.abs(wp.lateralOffset) % 1) * 12) * Math.sign(wp.lateralOffset || 1))
        setSelectedWall(wp.wallSide)
      }
    }
  }, [
    selected?.id,
    selected?.position.x,
    selected?.position.y,
    selected?.position.z,
    selected?.scale.x,
    selected?.scale.y,
    selected?.scale.z,
    selected?.targetDimensions?.width,
    selected?.targetDimensions?.height,
    selected?.targetDimensions?.depth,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selected as any)?.wallPlacement?.heightFromFloor,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selected as any)?.wallPlacement?.lateralOffset,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (selected as any)?.wallPlacement?.wallSide
  ])

  if (!selected) return null

  const isInstance = 'isInstance' in selected && selected.isInstance

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPosition = { ...selected.position, [axis]: value }
    if (isInstance) {
      updateInstance(selected.id, { position: newPosition })
    } else {
      updateFurniture(selected.id, { position: newPosition })
    }
  }

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', feet: number, inches: number) => {
    const totalFeet = feet + inches / 12
    const newDimensions = {
      ...(selected.targetDimensions || { width: 1, height: 1, depth: 1 }),
      [dimension]: totalFeet
    }

    if (isInstance && selectedItem) {
      // Update the Item template (affects all instances)
      updateItem(selectedItem.id, { dimensions: newDimensions })
    } else if (!isInstance) {
      // Legacy furniture update
      updateFurniture(selected.id, { targetDimensions: newDimensions })
    }
  }

  const handleEditItem = () => {
    if (selectedInstance && selectedItem) {
      // Encode return context in URL
      const returnContext = encodeURIComponent(JSON.stringify({
        homeId: currentHomeId,
        instanceId: selectedInstance.id,
      }))
      router.push(`/items/${selectedItem.id}?returnTo=${returnContext}`)
    }
  }

  // Wall placement change handlers
  const handleWallHeightChange = (feet: number, inches: number) => {
    const totalFeet = feet + inches / 12
    if (selectedInstance && selected && 'wallPlacement' in selected && selected.wallPlacement) {
      updateInstance(selected.id, {
        wallPlacement: {
          ...selected.wallPlacement,
          heightFromFloor: totalFeet
        }
      })
    }
  }

  const handleLateralOffsetChange = (feet: number, inches: number) => {
    const totalFeet = feet + inches / 12
    if (selectedInstance && selected && 'wallPlacement' in selected && selected.wallPlacement) {
      updateInstance(selected.id, {
        wallPlacement: {
          ...selected.wallPlacement,
          lateralOffset: totalFeet
        }
      })
    }
  }

  const handleWallChange = (newWall: WallSide) => {
    if (selectedInstance && selected && 'wallPlacement' in selected && selected.wallPlacement) {
      updateInstance(selected.id, {
        wallPlacement: {
          ...selected.wallPlacement,
          wallSide: newWall
        }
      })
    }
  }

  const handleScaleChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newScale = { ...selected.scale, [axis]: value }
    if (isInstance) {
      updateInstance(selected.id, { scaleMultiplier: newScale })
    } else {
      updateFurniture(selected.id, { scale: newScale })
    }
  }

  const handleUniformScale = (value: number) => {
    const newScale = { x: value, y: value, z: value }
    setScaleX(value)
    setScaleY(value)
    setScaleZ(value)
    if (isInstance) {
      updateInstance(selected.id, { scaleMultiplier: newScale })
    } else {
      updateFurniture(selected.id, { scale: newScale })
    }
  }

  return (
    <div className="fixed left-6 bottom-6 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-orange-500/30 w-96 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h2 className="text-white font-semibold text-lg">{selected.name}</h2>
          <p className="text-white/60 text-sm">{selected.category || 'uncategorized'}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Resize Mode Toggle */}
          <button
            onClick={() => setResizeMode(!isResizeMode)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isResizeMode
                ? 'bg-orange-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white'
            }`}
            title="Toggle resize mode (R)"
          >
            Resize
          </button>
          {isInstance && selectedItem && (
            <button
              onClick={handleEditItem}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm rounded-lg transition-colors"
            >
              Edit Item
            </button>
          )}
          <button
            onClick={() => setSelectedFurnitureId(null)}
            className="text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Wall Placement Controls (for wall-mounted items) */}
      {'isWallItem' in selected && selected.isWallItem && selected.wallPlacement && (
        <div className="mb-4">
          <h3 className="text-white font-medium text-sm mb-2">Wall Position</h3>
          <div className="space-y-2">
            {/* Wall Selection */}
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-14">Wall:</label>
              <select
                value={selectedWall}
                onChange={(e) => {
                  const newWall = e.target.value as WallSide
                  setSelectedWall(newWall)
                  handleWallChange(newWall)
                }}
                className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none capitalize"
              >
                {WALL_SIDES.map(side => (
                  <option key={side} value={side} className="bg-gray-800 capitalize">
                    {side}
                  </option>
                ))}
              </select>
            </div>

            {/* Height from Floor */}
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-14">Height:</label>
              <input
                type="number"
                value={wallHeightFeet}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setWallHeightFeet(val)
                  handleWallHeightChange(val, wallHeightInches)
                }}
                min="0"
                className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
              />
              <span className="text-white/50 text-xs">ft</span>
              <input
                type="number"
                value={wallHeightInches.toFixed(1)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setWallHeightInches(val)
                  handleWallHeightChange(wallHeightFeet, val)
                }}
                step="0.5"
                min="0"
                max="11.9"
                className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
              />
              <span className="text-white/50 text-xs">in</span>
            </div>

            {/* Lateral Offset */}
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-14">Offset:</label>
              <input
                type="number"
                value={lateralOffsetFeet}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0
                  setLateralOffsetFeet(val)
                  handleLateralOffsetChange(val, lateralOffsetInches)
                }}
                className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
              />
              <span className="text-white/50 text-xs">ft</span>
              <input
                type="number"
                value={lateralOffsetInches.toFixed(1)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setLateralOffsetInches(val)
                  handleLateralOffsetChange(lateralOffsetFeet, val)
                }}
                step="0.5"
                className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
              />
              <span className="text-white/50 text-xs">in</span>
            </div>
            <p className="text-white/40 text-xs pl-14">Positive = right when facing wall</p>
          </div>
        </div>
      )}

      {/* Position Controls (for floor items) */}
      {!('isWallItem' in selected && selected.isWallItem) && (
        <div className="mb-4">
          <h3 className="text-white font-medium text-sm mb-2">Position (feet)</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-6">X:</label>
              <input
                type="number"
                value={posX.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setPosX(val)
                  handlePositionChange('x', val)
                }}
                step="0.1"
                className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-6">Y:</label>
              <input
                type="number"
                value={posY.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setPosY(val)
                  handlePositionChange('y', val)
                }}
                step="0.1"
                className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-6">Z:</label>
              <input
                type="number"
                value={posZ.toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setPosZ(val)
                  handlePositionChange('z', val)
                }}
                step="0.1"
                className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dimensions Controls */}
      <div className="mb-4">
        <h3 className="text-white font-medium text-sm mb-2">Dimensions</h3>
        {isInstance && (
          <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-400 text-xs">
              Changes affect the item template and all instances.
            </p>
          </div>
        )}
        <div className="space-y-2">
          {/* Width */}
          <div className="flex items-center gap-2">
            <label className="text-white/70 text-sm w-14">Width:</label>
            <input
              type="number"
              value={widthFeet}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setWidthFeet(val)
                handleDimensionChange('width', val, widthInches)
              }}
              min="0"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">ft</span>
            <input
              type="number"
              value={widthInches.toFixed(1)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                setWidthInches(val)
                handleDimensionChange('width', widthFeet, val)
              }}
              step="0.1"
              min="0"
              max="11.9"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">in</span>
          </div>

          {/* Height */}
          <div className="flex items-center gap-2">
            <label className="text-white/70 text-sm w-14">Height:</label>
            <input
              type="number"
              value={heightFeet}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setHeightFeet(val)
                handleDimensionChange('height', val, heightInches)
              }}
              min="0"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">ft</span>
            <input
              type="number"
              value={heightInches.toFixed(1)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                setHeightInches(val)
                handleDimensionChange('height', heightFeet, val)
              }}
              step="0.1"
              min="0"
              max="11.9"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">in</span>
          </div>

          {/* Depth */}
          <div className="flex items-center gap-2">
            <label className="text-white/70 text-sm w-14">Depth:</label>
            <input
              type="number"
              value={depthFeet}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setDepthFeet(val)
                handleDimensionChange('depth', val, depthInches)
              }}
              min="0"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">ft</span>
            <input
              type="number"
              value={depthInches.toFixed(1)}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0
                setDepthInches(val)
                handleDimensionChange('depth', depthFeet, val)
              }}
              step="0.1"
              min="0"
              max="11.9"
              className="w-16 bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
            />
            <span className="text-white/50 text-xs">in</span>
          </div>
        </div>
      </div>

      {/* Advanced Scale Controls (Collapsible) */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvancedScale(!showAdvancedScale)}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm mb-2 transition-colors"
        >
          <span>{showAdvancedScale ? '▼' : '▶'}</span>
          <span>Advanced Scale</span>
        </button>

        {showAdvancedScale && (
          <div className="space-y-2 pl-4 pt-2 border-l border-white/20">
            {/* Uniform Scale */}
            <div className="flex items-center gap-2">
              <label className="text-white/70 text-sm w-20">Uniform:</label>
              <input
                type="number"
                value={scaleX.toFixed(3)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0.001
                  handleUniformScale(val)
                }}
                step="0.01"
                min="0.001"
                className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
              />
            </div>

            {/* Individual Axes */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <label className="text-white/70 text-sm w-20">Scale X:</label>
                <input
                  type="number"
                  value={scaleX.toFixed(3)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.001
                    setScaleX(val)
                    handleScaleChange('x', val)
                  }}
                  step="0.01"
                  min="0.001"
                  className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white/70 text-sm w-20">Scale Y:</label>
                <input
                  type="number"
                  value={scaleY.toFixed(3)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.001
                    setScaleY(val)
                    handleScaleChange('y', val)
                  }}
                  step="0.01"
                  min="0.001"
                  className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-white/70 text-sm w-20">Scale Z:</label>
                <input
                  type="number"
                  value={scaleZ.toFixed(3)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.001
                    setScaleZ(val)
                    handleScaleChange('z', val)
                  }}
                  step="0.01"
                  min="0.001"
                  className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Hint */}
      <div className="text-white/50 text-xs pt-3 border-t border-white/10">
        {'isWallItem' in selected && selected.isWallItem ? (
          <p>💡 ↑↓ adjust height • ←→ slide along wall • Drag to reposition</p>
        ) : (
          <p>💡 Arrow keys to move • R to resize • Drag to reposition</p>
        )}
      </div>
    </div>
  )
}
