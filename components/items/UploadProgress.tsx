'use client'

import { UploadProgress } from '@/types/room'

export function UploadProgressBar({ fileName, progress, status, error, stage }: UploadProgress) {
  const getStatusColor = () => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      case 'processing': return 'bg-blue-500'
      default: return 'bg-blue-500'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'completed': return '✓'
      case 'error': return '✗'
      case 'processing': return '⟳'
      default: return '↑'
    }
  }

  const getStatusMessage = () => {
    if (status === 'completed') return 'Upload complete!'
    if (status === 'error') return 'Upload failed'
    if (status === 'uploading' && stage === 'model') return 'Uploading model...'
    if (status === 'processing' && stage === 'thumbnail') return 'Generating thumbnail...'
    return 'Uploading...'
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2">
          <span className={status === 'processing' ? 'animate-spin' : ''}>
            {getStatusIcon()}
          </span>
          {fileName}
        </span>
        <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <p className={`text-sm ${
        status === 'completed' ? 'text-green-600' :
        status === 'error' ? 'text-red-500' :
        'text-gray-600'
      }`}>
        {getStatusMessage()}
      </p>
    </div>
  )
}
