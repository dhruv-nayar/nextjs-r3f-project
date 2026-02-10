'use client'

interface ItemThumbnailProps {
  category: string
  name: string
}

export function ItemThumbnail({ category, name }: ItemThumbnailProps) {
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
      <div className="text-6xl mb-2">{getCategoryIcon()}</div>
      <p className="text-white/40 text-xs text-center px-2">{name}</p>
    </div>
  )
}
