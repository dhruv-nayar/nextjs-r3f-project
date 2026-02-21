'use client'

import { FaceMaterial, ExtrusionFaceId, TextureFitMode } from '@/types/room'
import { TextureUploader } from './TextureUploader'

interface FaceMaterialEditorProps {
  faceId: ExtrusionFaceId
  material: FaceMaterial
  onMaterialChange: (material: Partial<FaceMaterial>) => void
}

/**
 * Editor for a single face's material properties
 *
 * Features:
 * - Color picker
 * - Texture upload
 * - Stretch/tile mode toggle
 * - Tile repeat settings
 * - Roughness/metalness sliders
 */
export function FaceMaterialEditor({
  faceId,
  material,
  onMaterialChange,
}: FaceMaterialEditorProps) {
  const formatFaceId = (id: ExtrusionFaceId): string => {
    if (id === 'top') return 'Top Face'
    if (id === 'bottom') return 'Bottom Face'
    const match = id.match(/^side-(\d+)$/)
    if (match) {
      return `Side ${parseInt(match[1], 10) + 1}`
    }
    return id
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">{formatFaceId(faceId)} Material</h4>

      {/* Color */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={material.color}
            onChange={(e) => onMaterialChange({ color: e.target.value })}
            className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={material.color}
            onChange={(e) => onMaterialChange({ color: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="#FFFFFF"
          />
        </div>
      </div>

      {/* Texture */}
      <TextureUploader
        texturePath={material.texturePath}
        onTextureChange={(path) => onMaterialChange({ texturePath: path })}
      />

      {/* Texture mode (only show if texture is set) */}
      {material.texturePath && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Texture Mode
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onMaterialChange({ textureMode: 'stretch' })}
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  material.textureMode !== 'tile'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                }`}
              >
                Stretch
              </button>
              <button
                onClick={() =>
                  onMaterialChange({
                    textureMode: 'tile',
                    textureRepeat: material.textureRepeat || { x: 1, y: 1 },
                  })
                }
                className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  material.textureMode === 'tile'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400 text-gray-600'
                }`}
              >
                Tile
              </button>
            </div>
          </div>

          {/* Tile repeat (only show in tile mode) */}
          {material.textureMode === 'tile' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Repeat
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">X</label>
                  <input
                    type="number"
                    value={material.textureRepeat?.x ?? 1}
                    onChange={(e) =>
                      onMaterialChange({
                        textureRepeat: {
                          x: parseFloat(e.target.value) || 1,
                          y: material.textureRepeat?.y ?? 1,
                        },
                      })
                    }
                    min={0.1}
                    step={0.5}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Y</label>
                  <input
                    type="number"
                    value={material.textureRepeat?.y ?? 1}
                    onChange={(e) =>
                      onMaterialChange({
                        textureRepeat: {
                          x: material.textureRepeat?.x ?? 1,
                          y: parseFloat(e.target.value) || 1,
                        },
                      })
                    }
                    min={0.1}
                    step={0.5}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced: Roughness/Metalness */}
      <details className="group">
        <summary className="text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700">
          Advanced
        </summary>
        <div className="mt-3 space-y-3">
          {/* Roughness */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-gray-400">Roughness</label>
              <span className="text-xs text-gray-500">{(material.roughness ?? 0.7).toFixed(1)}</span>
            </div>
            <input
              type="range"
              value={material.roughness ?? 0.7}
              onChange={(e) => onMaterialChange({ roughness: parseFloat(e.target.value) })}
              min={0}
              max={1}
              step={0.1}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Metalness */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs text-gray-400">Metalness</label>
              <span className="text-xs text-gray-500">{(material.metalness ?? 0.1).toFixed(1)}</span>
            </div>
            <input
              type="range"
              value={material.metalness ?? 0.1}
              onChange={(e) => onMaterialChange({ metalness: parseFloat(e.target.value) })}
              min={0}
              max={1}
              step={0.1}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </details>
    </div>
  )
}
