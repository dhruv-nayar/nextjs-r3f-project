'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import Image from 'next/image'
import { Asset } from '@/app/api/assets/list/route'

type FilterType = 'all' | 'image' | 'model'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)

  useEffect(() => {
    loadAssets()
  }, [])

  async function loadAssets() {
    try {
      setIsLoading(true)
      const response = await fetch('/api/assets/list')
      const data = await response.json()

      if (data.success) {
        setAssets(data.assets)
      } else {
        setError(data.error || 'Failed to load assets')
      }
    } catch (err) {
      setError('Failed to load assets')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDelete(url: string) {
    if (!confirm('Are you sure you want to delete this asset? This cannot be undone.')) {
      return
    }

    setDeletingUrl(url)
    try {
      const response = await fetch('/api/assets/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()
      if (data.success) {
        setAssets(prev => prev.filter(a => a.url !== url))
      } else {
        alert('Failed to delete: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Failed to delete asset')
    } finally {
      setDeletingUrl(null)
    }
  }

  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true
    if (filter === 'image') return asset.type === 'image' || asset.type === 'thumbnail'
    if (filter === 'model') return asset.type === 'model'
    return true
  })

  const counts = {
    all: assets.length,
    image: assets.filter(a => a.type === 'image' || a.type === 'thumbnail').length,
    model: assets.filter(a => a.type === 'model').length,
  }

  return (
    <div className="min-h-screen bg-porcelain">
      <Navbar activeTab="assets" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold text-graphite">Assets</h1>
            <p className="text-taupe/70 mt-1">All uploaded images and generated models</p>
          </div>
          <button
            onClick={loadAssets}
            className="px-4 py-2 text-sm font-medium text-taupe/70 hover:text-graphite transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'image', 'model'] as FilterType[]).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg font-body text-sm transition-colors ${
                filter === type
                  ? 'bg-graphite text-white'
                  : 'bg-white text-taupe/70 hover:text-graphite border border-taupe/10'
              }`}
            >
              {type === 'all' && `All (${counts.all})`}
              {type === 'image' && `Images (${counts.image})`}
              {type === 'model' && `Models (${counts.model})`}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-scarlet/10 border border-scarlet/20 rounded-lg p-4 text-scarlet">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredAssets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-display font-semibold text-graphite mb-2">No assets found</h3>
            <p className="text-taupe/70">Upload images or generate models to see them here</p>
          </div>
        )}

        {/* Assets Grid */}
        {!isLoading && !error && filteredAssets.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredAssets.map(asset => (
              <div
                key={asset.url}
                className="bg-white rounded-xl border border-taupe/10 overflow-hidden group hover:shadow-lg transition-shadow"
              >
                {/* Preview */}
                <div className="aspect-square relative bg-taupe/5">
                  {asset.type === 'model' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl">📦</span>
                    </div>
                  ) : (
                    <Image
                      src={asset.url}
                      alt={asset.pathname}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  )}

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-graphite/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-lg hover:bg-sage/20 transition-colors"
                      title="Open in new tab"
                    >
                      <svg className="w-5 h-5 text-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDelete(asset.url)}
                      disabled={deletingUrl === asset.url}
                      className="p-2 bg-white rounded-lg hover:bg-scarlet/20 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingUrl === asset.url ? (
                        <div className="w-5 h-5 border-2 border-scarlet/30 border-t-scarlet rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 text-scarlet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  {/* Type badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      asset.type === 'model'
                        ? 'bg-purple-100 text-purple-700'
                        : asset.subtype === 'processed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {asset.type === 'model' ? 'GLB' : asset.subtype === 'processed' ? 'Processed' : 'Image'}
                    </span>
                    {!asset.itemId && !asset.homeId && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        Orphaned
                      </span>
                    )}
                  </div>

                  {/* Size and date */}
                  <div className="text-xs text-taupe/50 space-y-0.5">
                    <div>{formatBytes(asset.size)}</div>
                    <div>{formatDate(asset.uploadedAt)}</div>
                    {asset.itemId && (
                      <div className="truncate" title={asset.itemId}>
                        Item: {asset.itemId.replace('item-', '').slice(0, 8)}...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
