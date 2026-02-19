'use client'

import { createContext, useContext, useCallback, useRef, ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Information about a surface hit from raycasting
 */
export interface SurfaceHit {
  surfaceType: 'floor' | 'item'
  surfaceId: string           // roomId for floor, instanceId for item surfaces
  point: THREE.Vector3        // World space hit point
  localPoint: THREE.Vector3   // Point relative to surface origin
  normal: THREE.Vector3       // Surface normal at hit point
  mesh: THREE.Mesh            // The mesh that was hit
}

/**
 * Context for storing references to placeable surface meshes
 * Used for raycasting placement of items on floors, rugs, shelves, etc.
 */
interface SurfaceMeshContextType {
  // Floor surfaces (from rooms)
  registerFloorSurface: (roomId: string, mesh: THREE.Mesh) => void
  unregisterFloorSurface: (roomId: string) => void
  getFloorSurface: (roomId: string) => THREE.Mesh | undefined

  // Item surfaces (rugs, shelves, etc.)
  registerItemSurface: (instanceId: string, mesh: THREE.Mesh) => void
  unregisterItemSurface: (instanceId: string) => void
  getItemSurface: (instanceId: string) => THREE.Mesh | undefined

  // Query all surfaces
  getAllFloorSurfaces: () => THREE.Mesh[]
  getAllItemSurfaces: () => THREE.Mesh[]
  getAllPlaceableSurfaces: () => THREE.Mesh[]

  // Raycasting helper
  raycastSurfaces: (raycaster: THREE.Raycaster) => SurfaceHit | null
}

const SurfaceMeshContext = createContext<SurfaceMeshContextType | null>(null)

interface SurfaceMeshProviderProps {
  children: ReactNode
}

export function SurfaceMeshProvider({ children }: SurfaceMeshProviderProps) {
  // Use refs to store meshes (doesn't cause re-renders when updated)
  const floorSurfacesRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const itemSurfacesRef = useRef<Map<string, THREE.Mesh>>(new Map())

  // Floor surface registration
  const registerFloorSurface = useCallback((roomId: string, mesh: THREE.Mesh) => {
    floorSurfacesRef.current.set(roomId, mesh)
    // Store metadata on the mesh for identification
    mesh.userData.surfaceType = 'floor'
    mesh.userData.surfaceId = roomId
    mesh.userData.roomId = roomId
  }, [])

  const unregisterFloorSurface = useCallback((roomId: string) => {
    floorSurfacesRef.current.delete(roomId)
  }, [])

  const getFloorSurface = useCallback((roomId: string) => {
    return floorSurfacesRef.current.get(roomId)
  }, [])

  // Item surface registration
  const registerItemSurface = useCallback((instanceId: string, mesh: THREE.Mesh) => {
    itemSurfacesRef.current.set(instanceId, mesh)
    // Store metadata on the mesh for identification
    mesh.userData.surfaceType = 'item'
    mesh.userData.surfaceId = instanceId
    mesh.userData.instanceId = instanceId
  }, [])

  const unregisterItemSurface = useCallback((instanceId: string) => {
    itemSurfacesRef.current.delete(instanceId)
  }, [])

  const getItemSurface = useCallback((instanceId: string) => {
    return itemSurfacesRef.current.get(instanceId)
  }, [])

  // Query functions
  const getAllFloorSurfaces = useCallback(() => {
    return Array.from(floorSurfacesRef.current.values())
  }, [])

  const getAllItemSurfaces = useCallback(() => {
    return Array.from(itemSurfacesRef.current.values())
  }, [])

  const getAllPlaceableSurfaces = useCallback(() => {
    return [
      ...Array.from(floorSurfacesRef.current.values()),
      ...Array.from(itemSurfacesRef.current.values())
    ]
  }, [])

  // Raycasting against all surfaces
  // Prioritizes item surfaces (closer hits) over floor
  const raycastSurfaces = useCallback((raycaster: THREE.Raycaster): SurfaceHit | null => {
    const allSurfaces = getAllPlaceableSurfaces()
    if (allSurfaces.length === 0) return null

    const intersects = raycaster.intersectObjects(allSurfaces, false)
    if (intersects.length === 0) return null

    // Find the closest hit
    const hit = intersects[0]
    const mesh = hit.object as THREE.Mesh
    const surfaceType = mesh.userData.surfaceType as 'floor' | 'item'
    const surfaceId = mesh.userData.surfaceId as string

    // Calculate local point relative to mesh origin
    const localPoint = hit.point.clone()
    mesh.worldToLocal(localPoint)

    // Get surface normal (default to up if not available)
    const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
    normal.applyQuaternion(mesh.quaternion)

    return {
      surfaceType,
      surfaceId,
      point: hit.point.clone(),
      localPoint,
      normal,
      mesh
    }
  }, [getAllPlaceableSurfaces])

  const value: SurfaceMeshContextType = {
    registerFloorSurface,
    unregisterFloorSurface,
    getFloorSurface,
    registerItemSurface,
    unregisterItemSurface,
    getItemSurface,
    getAllFloorSurfaces,
    getAllItemSurfaces,
    getAllPlaceableSurfaces,
    raycastSurfaces
  }

  return (
    <SurfaceMeshContext.Provider value={value}>
      {children}
    </SurfaceMeshContext.Provider>
  )
}

export function useSurfaceMesh() {
  const context = useContext(SurfaceMeshContext)
  if (!context) {
    throw new Error('useSurfaceMesh must be used within a SurfaceMeshProvider')
  }
  return context
}

/**
 * Optional version of useSurfaceMesh that returns null if not within provider
 * Use this in components that may render both inside and outside SurfaceMeshProvider
 */
export function useOptionalSurfaceMesh() {
  return useContext(SurfaceMeshContext)
}
