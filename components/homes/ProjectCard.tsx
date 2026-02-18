'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/design-system'
import { Home } from '@/types/room'

interface ProjectCardProps {
  home: Home
  onOpen: () => void
  onDelete: () => void
  onRename: (newName: string) => void
  canDelete?: boolean
  className?: string
}

export function ProjectCard({
  home,
  onOpen,
  onDelete,
  onRename,
  canDelete = true,
  className = ''
}: ProjectCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(home.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Calculate totals
  const totalItems = home.rooms.reduce((sum, room) =>
    sum + (room.instances?.length || 0) + (room.furniture?.length || 0), 0
  )

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    if (editName.trim() && editName !== home.name) {
      onRename(editName.trim())
    } else {
      setEditName(home.name)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditName(home.name)
      setIsEditing(false)
    }
  }

  return (
    <div className={cn('group overflow-hidden', className)}>
      {/* Thumbnail */}
      <div
        className="aspect-square relative rounded-lg overflow-hidden cursor-pointer"
        onClick={onOpen}
      >
        {home.thumbnailPath ? (
          <Image
            src={home.thumbnailPath}
            alt={home.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-taupe/5 to-taupe/10">
            <span className="text-6xl opacity-30">🏠</span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-graphite/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
            className="px-4 py-2 bg-sage hover:bg-sage/90 text-white rounded-lg text-sm font-medium font-body transition-colors"
          >
            Open
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="px-4 py-2 bg-scarlet/90 hover:bg-scarlet text-white rounded-lg text-sm font-medium font-body transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="pt-2">
        {/* Editable name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full font-display text-base text-graphite bg-transparent border-b border-sage focus:outline-none focus:border-sage/80 pb-0.5"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full text-left font-display text-base text-graphite truncate hover:text-sage transition-colors cursor-text"
            title="Click to rename"
          >
            {home.name}
          </button>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-taupe/60 font-body">
            {home.rooms.length} room{home.rooms.length !== 1 ? 's' : ''}
          </span>
          <span className="text-taupe/30">·</span>
          <span className="text-xs text-taupe/60 font-body">
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Last updated */}
        <p className="text-xs text-taupe/40 font-body mt-1">
          Updated {new Date(home.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

/**
 * AddProjectCard Component
 * Card for creating new projects
 */
interface AddProjectCardProps {
  onClick: () => void
  className?: string
}

export function AddProjectCard({ onClick, className = '' }: AddProjectCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-2 border-dashed border-taupe/15 rounded-lg aspect-square',
        'flex flex-col items-center justify-center gap-3',
        'hover:border-taupe/30 transition-all group',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full border-2 border-taupe/30 flex items-center justify-center text-2xl text-taupe/40 group-hover:border-taupe/50 group-hover:text-taupe/60 transition-colors">
        +
      </div>
      <span className="font-body text-sm text-taupe/60 group-hover:text-taupe/80 transition-colors uppercase tracking-wide">
        New Project
      </span>
    </button>
  )
}
