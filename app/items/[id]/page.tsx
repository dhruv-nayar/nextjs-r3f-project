'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'
import Toast from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Navbar } from '@/components/layout/Navbar'
import { cn } from '@/lib/design-system'

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
          <Button variant="primary" onClick={() => router.push('/items')}>
            Back to Items
          </Button>
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
      <Navbar activeTab="inventory" />

      {/* Main Content */}
      <div className="flex">
        {/* Main Content - Left Side (3D Viewer) */}
        <main className="flex-1 p-8">
          {/* Product Image with 3D Viewer */}
          <div className="max-w-3xl mx-auto">
            <div className="aspect-square bg-porcelain relative">
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
          </div>
        </main>

          {/* Sidebar - Right Side */}
          <aside className="lg:w-80 flex-shrink-0">
            <div className="lg:fixed lg:right-0 lg:top-0 lg:bottom-0 lg:w-80 lg:pt-20 lg:pb-6 lg:pr-6 flex flex-col">
              <div className="bg-floral-white rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)] border border-taupe/[0.03] flex-1 overflow-y-auto space-y-6">
                {/* Item Header Section */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-taupe/50 font-body mb-2">
                    {item.category}
                  </p>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-2xl font-display font-semibold text-graphite mb-4"
                    />
                  ) : (
                    <h1 className="text-2xl font-display font-semibold text-graphite mb-4">
                      {item.name}
                    </h1>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 mb-4">
                    {isEditing ? (
                      <>
                        <Button
                          variant="primary"
                          onClick={handleSave}
                          size="sm"
                          fullWidth
                        >
                          Save Changes
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setIsEditing(false)}
                          size="sm"
                          fullWidth
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => setIsEditing(true)}
                          size="sm"
                          fullWidth
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => setShowDeleteConfirm(true)}
                          size="sm"
                          fullWidth
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Description Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Description
                  </h3>
                  {isEditing ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-white text-graphite font-body text-sm rounded-xl border border-taupe/10 focus:outline-none focus:border-taupe/30 transition-colors resize-none"
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-taupe/80 font-body leading-relaxed">
                      {item.description || 'No description provided.'}
                    </p>
                  )}
                </div>

                {/* Dimensions Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Dimensions
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-taupe/10">
                      <p className="text-xs text-taupe/50 font-body mb-1">Width</p>
                      <p className="text-sm font-body font-medium text-graphite">
                        {item.dimensions?.width || '-'}"
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-taupe/10">
                      <p className="text-xs text-taupe/50 font-body mb-1">Height</p>
                      <p className="text-sm font-body font-medium text-graphite">
                        {item.dimensions?.height || '-'}"
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-taupe/10">
                      <p className="text-xs text-taupe/50 font-body mb-1">Depth</p>
                      <p className="text-sm font-body font-medium text-graphite">
                        {item.dimensions?.depth || '-'}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tags Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Tags
                  </h3>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Enter tags separated by commas"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.length > 0 ? (
                        item.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-sage/10 text-sage text-xs font-body rounded-full border border-sage/20"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-taupe/50 font-body">No tags</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Model Source Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Model Source
                  </h3>
                  <div className="bg-white rounded-xl p-3 border border-taupe/10">
                    <p className="text-sm font-body text-graphite">
                      {item.modelPath || item.thumbnailPath || 'No model file'}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-taupe/10"></div>

                {/* Instance Usage Section */}
                <div>
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
                      <div className="space-y-2">
                        {instances.map(({ instance, room, home }) => (
                          <Link
                            key={instance.id}
                            href="/"
                            className="block bg-white rounded-xl p-3 hover:bg-sage/10 transition-colors border border-taupe/10"
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

                {/* Recent Activity Section */}
                <div className="pt-6 border-t border-taupe/10">
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Recent Activity
                  </h3>
                  <div className="space-y-2 text-xs text-taupe/70 font-body">
                    <p>• Created {new Date(item.createdAt).toLocaleDateString()}</p>
                    <p>• Updated {new Date(item.updatedAt).toLocaleDateString()}</p>
                  </div>
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
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                size="lg"
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                size="lg"
                fullWidth
              >
                Delete
              </Button>
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
