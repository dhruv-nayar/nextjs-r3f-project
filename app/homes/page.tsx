'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { Navbar } from '@/components/layout/Navbar'
import { ProjectCard, AddProjectCard } from '@/components/homes/ProjectCard'
import { PageTitle } from '@/components/ui/Typography'

export default function HomesPage() {
  const router = useRouter()
  const { homes, createHome, deleteHome, switchHome, renameHome } = useHome()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Create home form state
  const [newHomeName, setNewHomeName] = useState('')
  const [newHomeDescription, setNewHomeDescription] = useState('')

  const handleCreateHome = () => {
    if (!newHomeName.trim()) {
      alert('Please enter a home name')
      return
    }

    // Create home with no rooms initially
    const homeId = createHome(newHomeName.trim(), [])

    // Reset form
    setNewHomeName('')
    setNewHomeDescription('')
    setShowCreateModal(false)

    // Navigate to floorplan editor
    router.push(`/floorplan?homeId=${homeId}&mode=new`)
  }

  const handleDeleteHome = (homeId: string) => {
    deleteHome(homeId)
    setShowDeleteConfirm(null)
  }

  const handleOpenHome = (homeId: string) => {
    switchHome(homeId)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-porcelain">
      {/* Navigation Bar */}
      <Navbar activeTab="projects" />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <PageTitle className="mb-1">All Projects</PageTitle>
            <p className="text-taupe/60 font-body text-sm">
              {homes.length} project{homes.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-sage hover:bg-sage/90 text-white font-medium font-body rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            New Project
          </button>
        </div>

        {/* Projects Grid */}
        {homes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 opacity-30">🏠</div>
            <p className="text-taupe/60 text-lg font-body mb-4">No projects yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-sage hover:bg-sage/90 text-white font-medium font-body rounded-lg transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {homes.map(home => (
              <ProjectCard
                key={home.id}
                home={home}
                onOpen={() => handleOpenHome(home.id)}
                onDelete={() => setShowDeleteConfirm(home.id)}
                onRename={(newName) => renameHome(home.id, newName)}
                canDelete={home.id !== 'example-home'}
              />
            ))}
            <AddProjectCard onClick={() => setShowCreateModal(true)} />
          </div>
        )}
      </div>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-graphite/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-floral-white border border-taupe/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-graphite text-xl font-display font-semibold">Create New Project</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-taupe/60 hover:text-graphite text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Home Name */}
              <div>
                <label className="block text-graphite/80 text-sm font-medium font-body mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newHomeName}
                  onChange={(e) => setNewHomeName(e.target.value)}
                  placeholder="My Apartment"
                  className="w-full px-4 py-2.5 bg-porcelain border border-taupe/20 rounded-lg text-graphite placeholder:text-taupe/40 focus:outline-none focus:border-sage font-body"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-graphite/80 text-sm font-medium font-body mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newHomeDescription}
                  onChange={(e) => setNewHomeDescription(e.target.value)}
                  placeholder="2 bedroom apartment in downtown"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-porcelain border border-taupe/20 rounded-lg text-graphite placeholder:text-taupe/40 focus:outline-none focus:border-sage font-body resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-taupe/10 hover:bg-taupe/20 text-graphite rounded-lg font-medium font-body transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateHome}
                  className="flex-1 px-4 py-2.5 bg-sage hover:bg-sage/90 text-white rounded-lg font-medium font-body transition-colors"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-graphite/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-floral-white border border-scarlet/20 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-graphite text-xl font-display font-semibold mb-4">Delete Project?</h3>
            <p className="text-graphite/70 font-body mb-6">
              Are you sure you want to delete <strong>{homes.find(h => h.id === showDeleteConfirm)?.name}</strong>? This will remove all rooms and items in this project.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-taupe/10 hover:bg-taupe/20 text-graphite rounded-lg font-medium font-body transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteHome(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-scarlet hover:bg-scarlet/90 text-white rounded-lg font-medium font-body transition-colors"
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
