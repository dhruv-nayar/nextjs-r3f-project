'use client'

import { useState } from 'react'
import { Room } from '@/types/room'
import { WallSide, WALL_DISPLAY_NAMES } from '@/types/selection'
import { useSelection } from '@/lib/selection-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { HierarchyItem, Icons } from './HierarchyItem'

interface RoomTreeNodeProps {
  room: Room
  isCurrentRoom?: boolean
}

const WALL_SIDES: WallSide[] = ['north', 'south', 'east', 'west']

export function RoomTreeNode({ room, isCurrentRoom = false }: RoomTreeNodeProps) {
  const {
    selection,
    selectRoom,
    selectWall,
    selectFloor,
    selectFurniture,
    isRoomSelected,
    isWallSelected,
    isFloorSelected,
    isFurnitureSelected,
    hoveredItem,
    setHoveredItem,
  } = useSelection()
  const { getItem } = useItemLibrary()

  // Expanded state for this room's sections
  const [isRoomExpanded, setIsRoomExpanded] = useState(isCurrentRoom)
  const [isWallsExpanded, setIsWallsExpanded] = useState(false)
  const [isFurnitureExpanded, setIsFurnitureExpanded] = useState(true)

  const instances = room.instances || []
  const furnitureCount = instances.length

  // Format dimensions for display
  const formatDimensions = () => {
    if (!room.dimensions) return null
    const { width, depth, height } = room.dimensions
    return `${width}'W x ${depth}'D x ${height}'H`
  }

  // Check if this room or any of its children are selected
  const isRoomOrChildSelected =
    isRoomSelected(room.id) ||
    WALL_SIDES.some((side) => isWallSelected(room.id, side)) ||
    isFloorSelected(room.id) ||
    instances.some((inst) => isFurnitureSelected(inst.id))

  // Check hover states
  const isRoomHovered = hoveredItem?.type === 'room' && hoveredItem.roomId === room.id

  return (
    <div className="mb-1">
      {/* Room Header */}
      <HierarchyItem
        label={room.name}
        icon={Icons.room}
        isSelected={isRoomSelected(room.id)}
        isHovered={isRoomHovered}
        isExpanded={isRoomExpanded}
        hasChildren={true}
        onClick={() => selectRoom(room.id)}
        onToggle={() => setIsRoomExpanded(!isRoomExpanded)}
        onHover={(hovered) =>
          setHoveredItem(hovered ? { type: 'room', roomId: room.id } : null)
        }
        secondaryLabel={formatDimensions() || undefined}
        className={isCurrentRoom && !isRoomSelected(room.id) ? 'border-sage/30' : ''}
      />

      {/* Room Children */}
      {isRoomExpanded && (
        <div className="mt-0.5">
          {/* Walls Group */}
          <HierarchyItem
            label="Walls"
            icon={Icons.group}
            indent={1}
            isExpanded={isWallsExpanded}
            hasChildren={true}
            onToggle={() => setIsWallsExpanded(!isWallsExpanded)}
            secondaryLabel="4"
          />

          {isWallsExpanded && (
            <div>
              {WALL_SIDES.map((side) => {
                const isSelected = isWallSelected(room.id, side)
                const isHovered =
                  hoveredItem?.type === 'wall' &&
                  hoveredItem.roomId === room.id &&
                  hoveredItem.side === side

                return (
                  <HierarchyItem
                    key={side}
                    label={WALL_DISPLAY_NAMES[side]}
                    icon={Icons.wall}
                    indent={2}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    onClick={() => selectWall(room.id, side)}
                    onHover={(hovered) =>
                      setHoveredItem(
                        hovered ? { type: 'wall', roomId: room.id, side } : null
                      )
                    }
                    secondaryLabel={room.dimensions ? `${room.dimensions.height}'` : undefined}
                  />
                )
              })}
            </div>
          )}

          {/* Floor */}
          <HierarchyItem
            label="Floor"
            icon={Icons.floor}
            indent={1}
            isSelected={isFloorSelected(room.id)}
            isHovered={
              hoveredItem?.type === 'floor' && hoveredItem.roomId === room.id
            }
            onClick={() => selectFloor(room.id)}
            onHover={(hovered) =>
              setHoveredItem(hovered ? { type: 'floor', roomId: room.id } : null)
            }
            secondaryLabel={
              room.dimensions
                ? `${room.dimensions.width}' x ${room.dimensions.depth}'`
                : undefined
            }
          />

          {/* Furniture Group */}
          <HierarchyItem
            label="Furniture"
            icon={Icons.group}
            indent={1}
            isExpanded={isFurnitureExpanded}
            hasChildren={furnitureCount > 0}
            onToggle={() => setIsFurnitureExpanded(!isFurnitureExpanded)}
            secondaryLabel={`${furnitureCount}`}
          />

          {isFurnitureExpanded && furnitureCount > 0 && (
            <div>
              {instances.map((instance) => {
                const item = getItem(instance.itemId)
                if (!item) return null

                const displayName = instance.customName || item.name
                const isSelected = isFurnitureSelected(instance.id)
                const isHovered =
                  hoveredItem?.type === 'furniture' &&
                  hoveredItem.instanceId === instance.id

                return (
                  <HierarchyItem
                    key={instance.id}
                    label={displayName}
                    icon={Icons.furniture}
                    indent={2}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    onClick={() => selectFurniture(instance.id, room.id)}
                    onHover={(hovered) =>
                      setHoveredItem(
                        hovered
                          ? { type: 'furniture', instanceId: instance.id, roomId: room.id }
                          : null
                      )
                    }
                    secondaryLabel={item.category}
                  />
                )
              })}
            </div>
          )}

          {isFurnitureExpanded && furnitureCount === 0 && (
            <div className="text-white/40 text-xs pl-12 py-1">No furniture</div>
          )}
        </div>
      )}
    </div>
  )
}
