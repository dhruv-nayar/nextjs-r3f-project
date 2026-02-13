'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHome } from '@/lib/home-context'
import { Room } from '@/types/room'

interface HomeCreationProps {
  onClose: () => void
}

export function HomeCreation({ onClose }: HomeCreationProps) {
  const router = useRouter()
  const { createHome } = useHome()
  const [step, setStep] = useState<'name' | 'method' | 'dimensions' | 'floorplan'>('name')
  const [homeName, setHomeName] = useState('')
  const [method, setMethod] = useState<'dimensions' | 'floorplan' | null>(null)

  // Room dimensions
  const [roomName, setRoomName] = useState('Living Room')
  const [widthFeet, setWidthFeet] = useState(20)
  const [depthFeet, setDepthFeet] = useState(20)
  const [heightFeet, setHeightFeet] = useState(10)

  // Floorplan
  const [floorplanImage, setFloorplanImage] = useState<File | null>(null)
  const [floorplanWidthFeet, setFloorplanWidthFeet] = useState(20)
  const [floorplanHeightFeet, setFloorplanHeightFeet] = useState(20)

  const handleCreateWithDimensions = () => {
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName,
      furniture: [],
      cameraPosition: { x: widthFeet * 0.75, y: heightFeet + 5, z: depthFeet },
      cameraTarget: { x: 0, y: heightFeet / 2, z: 0 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }

    const homeId = createHome(homeName, [newRoom])
    onClose()

    // Redirect to floorplan editor
    router.push(`/floorplan?homeId=${homeId}`)
  }

  const handleCreateWithFloorplan = () => {
    if (!floorplanImage) return

    // Create a room with floorplan config
    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: roomName,
      furniture: [],
      floorplan: {
        imagePath: URL.createObjectURL(floorplanImage),
        widthFeet: floorplanWidthFeet,
        heightFeet: floorplanHeightFeet
      },
      cameraPosition: { x: floorplanWidthFeet * 0.75, y: 15, z: floorplanHeightFeet },
      cameraTarget: { x: 0, y: 2, z: 0 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }

    const homeId = createHome(homeName, [newRoom])
    onClose()

    // Redirect to floorplan editor
    router.push(`/floorplan?homeId=${homeId}`)
  }

  const handleDrawFloorplan = () => {
    // Create empty home and redirect to floorplan editor
    const homeId = createHome(homeName, [])

    onClose()

    // Redirect to floorplan editor
    router.push(`/floorplan?homeId=${homeId}&mode=new`)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-black/90 rounded-2xl shadow-2xl border border-white/20 max-w-2xl w-full p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-2xl">Create New Home</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Step 1: Home Name */}
        {step === 'name' && (
          <div className="space-y-6">
            <div>
              <label className="text-white font-medium mb-2 block">Home Name</label>
              <input
                type="text"
                value={homeName}
                onChange={(e) => setHomeName(e.target.value)}
                placeholder="My New Home"
                className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('method')}
                disabled={!homeName.trim()}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose Method */}
        {step === 'method' && (
          <div className="space-y-6">
            <p className="text-white/70">How would you like to create your first room?</p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setMethod('dimensions')
                  setStep('dimensions')
                }}
                className="p-6 rounded-xl border-2 border-white/20 hover:border-blue-500 hover:bg-white/5 transition-all group"
              >
                <div className="text-4xl mb-3">📐</div>
                <h3 className="text-white font-semibold mb-2">Define Dimensions</h3>
                <p className="text-white/60 text-sm">
                  Create a room by specifying width, depth, and height
                </p>
              </button>

              <button
                onClick={handleDrawFloorplan}
                className="p-6 rounded-xl border-2 border-white/20 hover:border-blue-500 hover:bg-white/5 transition-all group relative"
              >
                <div className="absolute top-2 right-2 bg-green-600/80 text-white text-xs px-2 py-1 rounded">
                  New!
                </div>
                <div className="text-4xl mb-3">✏️</div>
                <h3 className="text-white font-semibold mb-2">Draw Floorplan</h3>
                <p className="text-white/60 text-sm">
                  Draw rooms in 2D and convert to 3D model
                </p>
              </button>
            </div>

            <div className="flex justify-start">
              <button
                onClick={() => setStep('name')}
                className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Define Dimensions */}
        {step === 'dimensions' && (
          <div className="space-y-6">
            <div>
              <label className="text-white font-medium mb-2 block">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-white font-medium mb-2 block">Width (feet)</label>
                <input
                  type="number"
                  value={widthFeet}
                  onChange={(e) => setWidthFeet(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-white font-medium mb-2 block">Depth (feet)</label>
                <input
                  type="number"
                  value={depthFeet}
                  onChange={(e) => setDepthFeet(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-white font-medium mb-2 block">Height (feet)</label>
                <input
                  type="number"
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('method')}
                className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateWithDimensions}
                disabled={!roomName.trim() || widthFeet <= 0 || depthFeet <= 0 || heightFeet <= 0}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Home
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Upload Floorplan */}
        {step === 'floorplan' && (
          <div className="space-y-6">
            <div>
              <label className="text-white font-medium mb-2 block">Room Name</label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-white font-medium mb-2 block">Floorplan Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFloorplanImage(e.target.files?.[0] || null)}
                className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white font-medium mb-2 block">Floorplan Width (feet)</label>
                <input
                  type="number"
                  value={floorplanWidthFeet}
                  onChange={(e) => setFloorplanWidthFeet(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-white font-medium mb-2 block">Floorplan Height (feet)</label>
                <input
                  type="number"
                  value={floorplanHeightFeet}
                  onChange={(e) => setFloorplanHeightFeet(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-white/10 text-white px-4 py-3 rounded-lg border border-white/20 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('method')}
                className="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateWithFloorplan}
                disabled={!roomName.trim() || !floorplanImage || floorplanWidthFeet <= 0 || floorplanHeightFeet <= 0}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Home
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
