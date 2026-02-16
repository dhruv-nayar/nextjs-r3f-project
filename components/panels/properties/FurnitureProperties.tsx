'use client'

import { useRouter } from 'next/navigation'
import { ItemInstance, Item } from '@/types/room'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { useResizeMode } from '@/lib/resize-mode-context'
import { PropertySection, NumberInput, PropertyRow } from '../shared'

interface FurniturePropertiesProps {
  instance: ItemInstance
  item: Item
}

export function FurnitureProperties({ instance, item }: FurniturePropertiesProps) {
  const router = useRouter()
  const { updateInstance } = useRoom()
  const { currentHomeId } = useHome()
  const { updateItem } = useItemLibrary()
  const { isResizeMode, setResizeMode } = useResizeMode()

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    updateInstance(instance.id, {
      position: {
        ...instance.position,
        [axis]: value,
      },
    })
  }

  const handleRotationYChange = (degrees: number) => {
    // Convert degrees to radians
    const radians = (degrees * Math.PI) / 180
    updateInstance(instance.id, {
      rotation: {
        ...instance.rotation,
        y: radians,
      },
    })
  }

  const handleEditItem = () => {
    const returnContext = encodeURIComponent(
      JSON.stringify({
        homeId: currentHomeId,
        instanceId: instance.id,
      })
    )
    router.push(`/items/${item.id}?returnTo=${returnContext}`)
  }

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    updateItem(item.id, {
      dimensions: {
        ...item.dimensions,
        [dimension]: value,
      },
    })
  }

  // Convert rotation to degrees for display
  const rotationYDegrees = (instance.rotation.y * 180) / Math.PI

  return (
    <div>
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
            <div>
              <h3 className="text-white font-medium">
                {instance.customName || item.name}
              </h3>
              <span className="text-white/50 text-xs capitalize">{item.category}</span>
            </div>
          </div>
          <div className="flex gap-2">
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
            <button
              onClick={handleEditItem}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm rounded-lg transition-colors"
            >
              Edit Item
            </button>
          </div>
        </div>
      </div>

      {/* Position */}
      <PropertySection title="Position (feet)">
        <NumberInput
          label="X"
          value={instance.position.x}
          onChange={(v) => handlePositionChange('x', v)}
          labelWidth="w-8"
        />
        <NumberInput
          label="Y"
          value={instance.position.y}
          onChange={(v) => handlePositionChange('y', v)}
          labelWidth="w-8"
        />
        <NumberInput
          label="Z"
          value={instance.position.z}
          onChange={(v) => handlePositionChange('z', v)}
          labelWidth="w-8"
        />
      </PropertySection>

      {/* Rotation */}
      <PropertySection title="Rotation">
        <NumberInput
          label="Y"
          value={rotationYDegrees}
          onChange={handleRotationYChange}
          step={15}
          suffix="deg"
          labelWidth="w-8"
        />
      </PropertySection>

      {/* Dimensions - Editable */}
      <PropertySection title="Dimensions (feet)" defaultOpen={isResizeMode}>
        <div className="mb-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-amber-400 text-xs">
            Changes affect all instances of this item
          </p>
        </div>
        <NumberInput
          label="W"
          value={item.dimensions.width}
          onChange={(v) => handleDimensionChange('width', v)}
          step={0.1}
          min={0.1}
          labelWidth="w-8"
        />
        <NumberInput
          label="H"
          value={item.dimensions.height}
          onChange={(v) => handleDimensionChange('height', v)}
          step={0.1}
          min={0.1}
          labelWidth="w-8"
        />
        <NumberInput
          label="D"
          value={item.dimensions.depth}
          onChange={(v) => handleDimensionChange('depth', v)}
          step={0.1}
          min={0.1}
          labelWidth="w-8"
        />
      </PropertySection>

      {/* Item Info */}
      <PropertySection title="Item Details" defaultOpen={false}>
        {item.productUrl && (
          <PropertyRow label="Link" labelWidth="w-16">
            <a
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs underline truncate block"
            >
              View product
            </a>
          </PropertyRow>
        )}
      </PropertySection>

      {/* Quick Actions */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-white/40 text-xs">
          Arrow keys to move, R to resize, Delete to remove
        </p>
      </div>
    </div>
  )
}
