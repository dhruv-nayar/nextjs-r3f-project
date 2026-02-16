'use client'

import { createContext, useContext, useCallback, useRef, ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Key format for wall meshes: "{roomId}-{wallSide}"
 * Example: "room-123-north", "room-123-south"
 */
type WallKey = string

/**
 * Context for storing references to wall and ceiling meshes
 * Used for raycasting placement of wall/ceiling-mounted items
 */
interface WallMeshContextType {
  // Mesh storage
  wallMeshes: Map<WallKey, THREE.Mesh>
  ceilingMeshes: Map<string, THREE.Mesh>  // keyed by roomId

  // Registration functions
  registerWall: (roomId: string, side: 'north' | 'south' | 'east' | 'west', mesh: THREE.Mesh) => void
  unregisterWall: (roomId: string, side: 'north' | 'south' | 'east' | 'west') => void
  registerCeiling: (roomId: string, mesh: THREE.Mesh) => void
  unregisterCeiling: (roomId: string) => void

  // Getters
  getWallMesh: (roomId: string, side: 'north' | 'south' | 'east' | 'west') => THREE.Mesh | undefined
  getCeilingMesh: (roomId: string) => THREE.Mesh | undefined
  getAllWallMeshes: () => THREE.Mesh[]
  getAllCeilingMeshes: () => THREE.Mesh[]
}

const WallMeshContext = createContext<WallMeshContextType | null>(null)

interface WallMeshProviderProps {
  children: ReactNode
}

export function WallMeshProvider({ children }: WallMeshProviderProps) {
  // Use refs to store meshes (doesn't cause re-renders when updated)
  const wallMeshesRef = useRef<Map<WallKey, THREE.Mesh>>(new Map())
  const ceilingMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map())

  const makeWallKey = (roomId: string, side: string): WallKey => `${roomId}-${side}`

  const registerWall = useCallback((roomId: string, side: 'north' | 'south' | 'east' | 'west', mesh: THREE.Mesh) => {
    const key = makeWallKey(roomId, side)
    wallMeshesRef.current.set(key, mesh)
    // Store metadata on the mesh for identification
    mesh.userData.roomId = roomId
    mesh.userData.wallSide = side
    mesh.userData.surfaceType = 'wall'
  }, [])

  const unregisterWall = useCallback((roomId: string, side: 'north' | 'south' | 'east' | 'west') => {
    const key = makeWallKey(roomId, side)
    wallMeshesRef.current.delete(key)
  }, [])

  const registerCeiling = useCallback((roomId: string, mesh: THREE.Mesh) => {
    ceilingMeshesRef.current.set(roomId, mesh)
    mesh.userData.roomId = roomId
    mesh.userData.surfaceType = 'ceiling'
  }, [])

  const unregisterCeiling = useCallback((roomId: string) => {
    ceilingMeshesRef.current.delete(roomId)
  }, [])

  const getWallMesh = useCallback((roomId: string, side: 'north' | 'south' | 'east' | 'west') => {
    const key = makeWallKey(roomId, side)
    return wallMeshesRef.current.get(key)
  }, [])

  const getCeilingMesh = useCallback((roomId: string) => {
    return ceilingMeshesRef.current.get(roomId)
  }, [])

  const getAllWallMeshes = useCallback(() => {
    return Array.from(wallMeshesRef.current.values())
  }, [])

  const getAllCeilingMeshes = useCallback(() => {
    return Array.from(ceilingMeshesRef.current.values())
  }, [])

  const value: WallMeshContextType = {
    wallMeshes: wallMeshesRef.current,
    ceilingMeshes: ceilingMeshesRef.current,
    registerWall,
    unregisterWall,
    registerCeiling,
    unregisterCeiling,
    getWallMesh,
    getCeilingMesh,
    getAllWallMeshes,
    getAllCeilingMeshes
  }

  return (
    <WallMeshContext.Provider value={value}>
      {children}
    </WallMeshContext.Provider>
  )
}

export function useWallMesh() {
  const context = useContext(WallMeshContext)
  if (!context) {
    throw new Error('useWallMesh must be used within a WallMeshProvider')
  }
  return context
}
