'use client'

import Image from 'next/image'

interface ItemThumbnailProps {
  category: string
  name: string
  thumbnailPath?: string
}

export function ItemThumbnail({ category, name, thumbnailPath }: ItemThumbnailProps) {
  const getCategoryIcon = () => {
    switch (category) {
      case 'seating':
        return '🪑'
      case 'table':
        return '🪑'
      case 'storage':
        return '📚'
      case 'bed':
        return '🛏️'
      case 'decoration':
        return '🪴'
      case 'lighting':
        return '💡'
      default:
        return '📦'
    }
  }

  // Show actual 3D thumbnail if available
  if (thumbnailPath) {
    return (
      <div className="w-full h-full relative bg-gray-50">
        <Image
          src={thumbnailPath}
          alt={name}
          fill
          className="object-contain p-4"
          unoptimized
        />
      </div>
    )
  }

  // Fallback to emoji
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
      <div className="text-6xl mb-2">{getCategoryIcon()}</div>
      <p className="text-gray-400 text-xs text-center px-2">{name}</p>
    </div>
  )
}
