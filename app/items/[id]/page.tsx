'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

  const { getItem, updateItem, deleteItem } = useItemLibrary()
  const { getInstancesForItem, deleteAllInstancesOfItem } = useHome()

  const item = getItem(itemId)
  const instances = item ? getInstancesForItem(itemId) : []

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState(item?.name || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editTags, setEditTags] = useState(item?.tags.join(', ') || '')

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Item Not Found</h2>
          <Link
            href="/items"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-block transition-colors"
          >
            Back to Items
          </Link>
        </div>
      </div>
    )
  }

  const handleSave = () => {
    updateItem(itemId, {
      name: editName,
      description: editDescription,
      tags: editTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    })
    setIsEditing(false)
  }

  const handleDelete = () => {
    // First delete all instances of this item across all homes
    deleteAllInstancesOfItem(itemId)
    // Then delete the item from the library
    deleteItem(itemId)
    // Navigate back to items list
    router.push('/items')
  }

  return (
    <div className="p-8">
      {/* Back Button */}
      <Link
        href="/items"
        className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
      >
        <span>←</span>
        <span>Back to Items</span>
      </Link>

      {/* Details Sections */}
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-3xl font-bold text-white bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              ) : (
                <h2 className="text-3xl font-bold text-white mb-2">{item.name}</h2>
              )}
              <p className="text-white/60 capitalize">{item.category}</p>
            </div>

            {!isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-2">Description</h3>
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full text-white/90 bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Add a description..."
              />
            ) : (
              <p className="text-white/70">
                {item.description || 'No description provided'}
              </p>
            )}
          </div>

          {/* Dimensions */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Dimensions</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white/60 text-sm mb-1">Width</p>
                <p className="text-white font-semibold">{item.dimensions.width.toFixed(2)}'</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white/60 text-sm mb-1">Height</p>
                <p className="text-white font-semibold">{item.dimensions.height.toFixed(2)}'</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white/60 text-sm mb-1">Depth</p>
                <p className="text-white font-semibold">{item.dimensions.depth.toFixed(2)}'</p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-2">Tags</h3>
            {isEditing ? (
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full text-white/90 bg-white/10 border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            ) : (
              <div className="flex gap-2 flex-wrap">
                {item.tags.length > 0 ? (
                  item.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-white/10 text-white/70 rounded-lg text-sm"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-white/50 text-sm">No tags</span>
                )}
              </div>
            )}
          </div>

          {/* Edit Actions */}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false)
                  setEditName(item.name)
                  setEditDescription(item.description || '')
                  setEditTags(item.tags.join(', '))
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-1 text-xs text-white/40">
            <p>Created: {new Date(item.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(item.updatedAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Model Information */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-3">Model Information</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Model Path:</span>
              <span className="text-white/90 font-mono text-xs">{item.modelPath}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Type:</span>
              <span className="text-white/90">{item.isCustom ? 'Custom' : 'Built-in'}</span>
            </div>
          </div>
        </div>

        {/* Usage Section */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Used In</h3>
          {instances.length === 0 ? (
            <p className="text-white/50 text-sm">
              This item is not currently placed in any homes.
            </p>
          ) : (
            <div className="space-y-3">
              {instances.map(({ instance, room, home }) => (
                <div
                  key={instance.id}
                  className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">
                        {instance.customName || item.name}
                      </p>
                      <p className="text-white/60 text-sm">
                        {home.name} → {room.name}
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
              <p className="text-white/50 text-xs mt-4">
                {instances.length} placement{instances.length !== 1 ? 's' : ''} across {new Set(instances.map(i => i.home.id)).size} home{new Set(instances.map(i => i.home.id)).size !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white text-xl font-bold mb-4">Delete Item?</h3>

            {instances.length > 0 ? (
              <>
                <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-200 text-sm mb-2">
                    <strong>Warning:</strong> This item is currently used in {instances.length} placement{instances.length !== 1 ? 's' : ''} across {new Set(instances.map(i => i.home.id)).size} home{new Set(instances.map(i => i.home.id)).size !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-red-200/70 text-xs">
                    Deleting this item will remove all instances from your homes.
                  </p>
                </div>
                <p className="text-white/70 mb-6">
                  Are you sure you want to delete <strong>{item.name}</strong> and all its placements?
                </p>
              </>
            ) : (
              <p className="text-white/70 mb-6">
                Are you sure you want to delete <strong>{item.name}</strong>?
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
