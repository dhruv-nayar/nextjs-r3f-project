'use client'

import { useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { extractMaterials, MaterialInfo } from '@/lib/material-utils'

/**
 * Hook to extract materials from a GLB model
 * Must be called with a valid modelPath (not null/undefined)
 */
export function useMaterialExtraction(modelPath: string): MaterialInfo[] {
  const [materials, setMaterials] = useState<MaterialInfo[]>([])

  // Load the GLB file
  const gltf = useGLTF(modelPath)

  useEffect(() => {
    if (gltf?.scene) {
      try {
        const extractedMaterials = extractMaterials(gltf.scene)
        setMaterials(extractedMaterials)
      } catch (error) {
        console.error('Error extracting materials:', error)
        setMaterials([])
      }
    }
  }, [gltf])

  return materials
}

/**
 * Wrapper component that conditionally uses the hook
 * This allows us to handle the case where modelPath might be undefined
 */
export function MaterialExtractor({
  modelPath,
  onExtracted
}: {
  modelPath: string
  onExtracted: (materials: MaterialInfo[]) => void
}) {
  const materials = useMaterialExtraction(modelPath)

  useEffect(() => {
    if (materials.length > 0) {
      onExtracted(materials)
    }
  }, [materials, onExtracted])

  return null // This component doesn't render anything
}
