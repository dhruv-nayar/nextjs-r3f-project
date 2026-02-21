'use client'

import { CompositeShapePart } from '@/types/room'

interface ShapePartListProps {
  parts: CompositeShapePart[]
  selectedPartId: string | null
  onSelectPart: (partId: string | null) => void
  onToggleLocked: (partId: string) => void
  onToggleVisible: (partId: string) => void
  onRemovePart: (partId: string) => void
  onRenamePart: (partId: string, name: string) => void
  onAddPart: () => void
}

/**
 * List of parts in a composite shape
 *
 * Features:
 * - Select parts for editing
 * - Toggle locked state (prevents editing)
 * - Toggle visibility
 * - Remove parts
 * - Rename parts
 * - Add new parts
 */
export function ShapePartList({
  parts,
  selectedPartId,
  onSelectPart,
  onToggleLocked,
  onToggleVisible,
  onRemovePart,
  onRenamePart,
  onAddPart,
}: ShapePartListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Parts</h4>
        <button
          onClick={onAddPart}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Part
        </button>
      </div>

      {parts.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          No parts yet. Click "Add Part" to create one.
        </div>
      ) : (
        <div className="space-y-1">
          {parts.map((part) => (
            <PartListItem
              key={part.id}
              part={part}
              isSelected={part.id === selectedPartId}
              onSelect={() => onSelectPart(part.id === selectedPartId ? null : part.id)}
              onToggleLocked={() => onToggleLocked(part.id)}
              onToggleVisible={() => onToggleVisible(part.id)}
              onRemove={() => onRemovePart(part.id)}
              onRename={(name) => onRenamePart(part.id, name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface PartListItemProps {
  part: CompositeShapePart
  isSelected: boolean
  onSelect: () => void
  onToggleLocked: () => void
  onToggleVisible: () => void
  onRemove: () => void
  onRename: (name: string) => void
}

function PartListItem({
  part,
  isSelected,
  onSelect,
  onToggleLocked,
  onToggleVisible,
  onRemove,
  onRename,
}: PartListItemProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      } ${!part.visible ? 'opacity-50' : ''}`}
      onClick={(e) => {
        // Don't select if clicking buttons
        if ((e.target as HTMLElement).tagName === 'BUTTON') return
        if (!part.locked) {
          onSelect()
        }
      }}
    >
      {/* Visibility toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisible()
        }}
        className="p-1 hover:bg-gray-200 rounded transition-colors"
        title={part.visible ? 'Hide part' : 'Show part'}
      >
        {part.visible ? (
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
            />
          </svg>
        )}
      </button>

      {/* Lock toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleLocked()
        }}
        className="p-1 hover:bg-gray-200 rounded transition-colors"
        title={part.locked ? 'Unlock part' : 'Lock part'}
      >
        {part.locked ? (
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
        )}
      </button>

      {/* Part name (editable) */}
      <input
        type="text"
        value={part.name}
        onChange={(e) => onRename(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={`flex-1 px-2 py-0.5 text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded ${
          part.locked ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700'
        }`}
        disabled={part.locked}
      />

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="p-1 hover:bg-red-100 rounded transition-colors text-gray-400 hover:text-red-600"
        title="Remove part"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  )
}
