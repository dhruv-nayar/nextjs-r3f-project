'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'
import Toast from '@/components/ui/Toast'

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
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  // Edit form state
  const [editName, setEditName] = useState(item?.name || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editTags, setEditTags] = useState(item?.tags.join(', ') || '')

  if (!item) {
    return (
      <div className="min-h-screen bg-porcelain flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-display font-semibold text-graphite mb-4">Item Not Found</h2>
          <Link
            href="/items"
            className="px-6 py-3 bg-sage hover:bg-sage/90 text-white rounded-xl inline-block transition-colors font-body font-medium"
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
    setToastMessage('Item updated successfully!')
    setToastType('success')
    setShowToast(true)
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
    <div className="min-h-screen bg-porcelain">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-porcelain border-b border-taupe/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <span className="text-taupe text-xl">△</span>
              <h1 className="text-lg font-display font-medium text-graphite">Studio OMHU</h1>
            </div>

            {/* Right Side Navigation */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-6">
                <Link
                  href="/items"
                  className="text-graphite font-body font-medium relative pb-1 border-b-2 border-graphite"
                >
                  Inventory
                </Link>
                <Link
                  href="/"
                  className="text-taupe/70 font-body font-medium hover:text-graphite transition-colors"
                >
                  Projects
                </Link>
              </div>

              {/* Vertical Divider */}
              <div className="w-px h-5 bg-taupe/10"></div>

              <div className="flex items-center gap-3">
                <button className="w-9 h-9 rounded-full bg-white hover:bg-taupe/5 flex items-center justify-center transition-colors border border-taupe/10">
                  <span className="text-taupe text-sm">🔍</span>
                </button>
                <button className="w-9 h-9 rounded-full bg-white hover:bg-taupe/5 flex items-center justify-center transition-colors border border-taupe/10">
                  <span className="text-taupe text-sm">👤</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Main Content - Left Side */}
          <main className="flex-1 space-y-6">
            {/* Product Image Card with 3D Viewer */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-taupe/10">
              <div className="aspect-square bg-floral-white relative">
                <ItemThumbnail
                  category={item.category}
                  name={item.name}
                  thumbnailPath={item.thumbnailPath}
                />

                {/* 3D Controls Overlay (Placeholder) */}
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl border border-taupe/20 flex items-center justify-center hover:bg-white transition-colors">
                    <span className="text-sm">🔄</span>
                  </button>
                  <button className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl border border-taupe/20 flex items-center justify-center hover:bg-white transition-colors">
                    <span className="text-sm">🔍</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Product Info Card */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-taupe/10">
              {/* Header with Edit/Delete */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-3xl font-display font-semibold text-graphite bg-floral-white border border-taupe/20 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sage/50"
                    />
                  ) : (
                    <h2 className="text-3xl font-display font-semibold text-graphite mb-2">{item.name}</h2>
                  )}
                  <p className="text-taupe/70 font-body capitalize">{item.category}</p>
                </div>

                {!isEditing && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-sage text-white rounded-xl font-body font-medium hover:bg-sage/90 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-scarlet text-white rounded-xl font-body font-medium hover:bg-scarlet/90 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <div className="mb-6 pb-6 border-b border-taupe/10">
                <h3 className="font-display font-semibold text-graphite mb-3">Description</h3>
                {isEditing ? (
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full text-graphite bg-floral-white border border-taupe/20 rounded-xl px-4 py-3 font-body focus:outline-none focus:ring-2 focus:ring-sage/50 resize-none"
                    placeholder="Add a description..."
                  />
                ) : (
                  <p className="text-taupe/80 font-body leading-relaxed">
                    {item.description || 'No description provided'}
                  </p>
                )}
              </div>

              {/* Dimensions Grid */}
              <div className="mb-6 pb-6 border-b border-taupe/10">
                <h3 className="font-display font-semibold text-graphite mb-4">Dimensions</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-floral-white rounded-2xl p-4 text-center">
                    <p className="text-taupe/60 text-sm font-body mb-1">Width</p>
                    <p className="text-graphite text-xl font-display font-semibold">
                      {item.dimensions.width.toFixed(1)}'
                    </p>
                  </div>
                  <div className="bg-floral-white rounded-2xl p-4 text-center">
                    <p className="text-taupe/60 text-sm font-body mb-1">Height</p>
                    <p className="text-graphite text-xl font-display font-semibold">
                      {item.dimensions.height.toFixed(1)}'
                    </p>
                  </div>
                  <div className="bg-floral-white rounded-2xl p-4 text-center">
                    <p className="text-taupe/60 text-sm font-body mb-1">Depth</p>
                    <p className="text-graphite text-xl font-display font-semibold">
                      {item.dimensions.depth.toFixed(1)}'
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="mb-6 pb-6 border-b border-taupe/10">
                <h3 className="font-display font-semibold text-graphite mb-3">Tags</h3>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="tag1, tag2, tag3"
                    className="w-full text-graphite bg-floral-white border border-taupe/20 rounded-xl px-4 py-3 font-body focus:outline-none focus:ring-2 focus:ring-sage/50"
                  />
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {item.tags.length > 0 ? (
                      item.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1.5 bg-floral-white text-taupe rounded-lg text-sm font-body border border-taupe/10"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-taupe/50 text-sm font-body">No tags</span>
                    )}
                  </div>
                )}
              </div>

              {/* Model Source */}
              <div>
                <h3 className="font-display font-semibold text-graphite mb-3">Model Source</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-taupe/70 font-body">Model Path:</span>
                    <span className="text-graphite/70 font-mono text-xs break-all ml-4">{item.modelPath}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-taupe/70 font-body">Type:</span>
                    <span className="text-graphite font-body font-medium">{item.isCustom ? 'Custom' : 'Built-in'}</span>
                  </div>
                </div>
              </div>

              {/* Edit Actions */}
              {isEditing && (
                <div className="flex gap-3 mt-6 pt-6 border-t border-taupe/10">
                  <button
                    onClick={handleSave}
                    className="flex-1 px-4 py-3 bg-sage hover:bg-sage/90 text-white rounded-xl transition-colors font-body font-medium"
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
                    className="flex-1 px-4 py-3 bg-white border border-taupe/20 hover:bg-floral-white text-taupe rounded-xl transition-colors font-body font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </main>

          {/* Sidebar - Right Side */}
          <aside className="lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-28 space-y-4">
              {/* Usage Stats Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-taupe/10">
                <h3 className="font-display font-semibold text-graphite mb-4">
                  Instance Usage
                </h3>

                {instances.length === 0 ? (
                  <p className="text-sm text-taupe/70 font-body">
                    Not placed in any homes yet
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-3xl font-display font-semibold text-graphite">
                          {instances.length}
                        </p>
                        <p className="text-sm text-taupe/70 font-body">
                          Total placements
                        </p>
                      </div>
                    </div>

                    {/* Instance List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {instances.map(({ instance, room, home }) => (
                        <Link
                          key={instance.id}
                          href="/"
                          className="block bg-floral-white rounded-xl p-3 hover:bg-sage/10 transition-colors border border-taupe/10"
                        >
                          <p className="font-body font-medium text-graphite text-sm mb-1">
                            {instance.customName || item.name}
                          </p>
                          <p className="text-xs text-taupe/70 font-body">
                            {home.name} → {room.name}
                          </p>
                        </Link>
                      ))}
                    </div>

                    <p className="text-xs text-taupe/60 font-body mt-4">
                      {instances.length} placement{instances.length !== 1 ? 's' : ''} across {new Set(instances.map(i => i.home.id)).size} home{new Set(instances.map(i => i.home.id)).size !== 1 ? 's' : ''}
                    </p>
                  </>
                )}
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-taupe/10">
                <h3 className="font-display font-semibold text-graphite mb-3">
                  Recent Activity
                </h3>
                <div className="space-y-2 text-xs text-taupe/70 font-body">
                  <p>• Created {new Date(item.createdAt).toLocaleDateString()}</p>
                  <p>• Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-graphite/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-porcelain rounded-3xl p-8 max-w-md w-full shadow-2xl border border-scarlet/20">
            <h3 className="text-2xl font-display font-semibold text-graphite mb-4">
              Delete Item?
            </h3>

            {instances.length > 0 ? (
              <>
                <div className="mb-4 p-4 bg-scarlet/10 border border-scarlet/30 rounded-2xl">
                  <p className="text-scarlet text-sm font-body mb-2">
                    <strong>Warning:</strong> This item is used in {instances.length} placement{instances.length !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-scarlet/70 text-xs font-body">
                    All instances will be removed from your homes.
                  </p>
                </div>
                <p className="text-taupe/80 font-body mb-6">
                  Are you sure you want to delete <strong className="text-graphite">{item.name}</strong>?
                </p>
              </>
            ) : (
              <p className="text-taupe/80 font-body mb-6">
                Are you sure you want to delete <strong className="text-graphite">{item.name}</strong>?
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 bg-white border border-taupe/20 text-taupe rounded-xl font-body font-medium hover:bg-floral-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-3 bg-scarlet text-white rounded-xl font-body font-medium hover:bg-scarlet/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  )
}
