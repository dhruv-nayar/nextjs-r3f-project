import * as THREE from 'three'
import { FaceMaterial, ExtrusionShapeV2, ExtrusionFaceId, ExtrusionFaceMaterials } from '@/types/room'
import { getMaterialCount, getAllFaceIds } from './extrusion-geometry'

/**
 * Default material values
 */
export const DEFAULT_MATERIAL: FaceMaterial = {
  color: '#808080',
  metalness: 0.1,
  roughness: 0.7,
}

/**
 * Configures a texture based on the face material settings
 *
 * @param texture The THREE.Texture to configure
 * @param material The FaceMaterial settings
 */
export function configureTexture(texture: THREE.Texture, material: FaceMaterial): void {
  if (material.textureMode === 'tile' && material.textureRepeat) {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(material.textureRepeat.x, material.textureRepeat.y)
  } else {
    // Default to stretch mode
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
  }

  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
}

/**
 * Creates a MeshStandardMaterial from a FaceMaterial definition
 *
 * @param faceMaterial The face material definition
 * @param loadedTexture Optional pre-loaded texture
 * @returns A configured THREE.MeshStandardMaterial
 */
export function createMaterial(
  faceMaterial: FaceMaterial,
  loadedTexture?: THREE.Texture
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: faceMaterial.color || DEFAULT_MATERIAL.color,
    roughness: faceMaterial.roughness ?? DEFAULT_MATERIAL.roughness,
    metalness: faceMaterial.metalness ?? DEFAULT_MATERIAL.metalness,
  })

  if (loadedTexture) {
    // Clone the texture to avoid shared state issues
    const textureClone = loadedTexture.clone()
    configureTexture(textureClone, faceMaterial)
    material.map = textureClone
    material.needsUpdate = true
  }

  return material
}

/**
 * Gets the effective FaceMaterial for a specific face, considering defaults
 *
 * @param shape The ExtrusionShapeV2
 * @param faceId The face identifier
 * @returns The effective FaceMaterial (from faceMaterials or defaultMaterial)
 */
export function getEffectiveFaceMaterial(
  shape: ExtrusionShapeV2,
  faceId: ExtrusionFaceId
): FaceMaterial {
  return shape.faceMaterials?.[faceId] ?? shape.defaultMaterial
}

/**
 * Creates an array of materials for all faces of an ExtrusionShapeV2
 *
 * The material array is ordered:
 * - Index 0: top cap
 * - Index 1: bottom cap
 * - Index 2+: side faces (one per polygon edge)
 *
 * @param shape The ExtrusionShapeV2
 * @param loadedTextures Map of texture paths to loaded THREE.Texture objects
 * @returns Array of THREE.MeshStandardMaterial
 */
export function createAllFaceMaterials(
  shape: ExtrusionShapeV2,
  loadedTextures: Map<string, THREE.Texture>
): THREE.MeshStandardMaterial[] {
  const numPoints = shape.points.length
  const faceIds = getAllFaceIds(numPoints)
  const materials: THREE.MeshStandardMaterial[] = []

  for (const faceId of faceIds) {
    const faceMat = getEffectiveFaceMaterial(shape, faceId)
    const texture = faceMat.texturePath ? loadedTextures.get(faceMat.texturePath) : undefined
    materials.push(createMaterial(faceMat, texture))
  }

  return materials
}

/**
 * Collects all unique texture paths from an ExtrusionShapeV2
 *
 * @param shape The ExtrusionShapeV2
 * @returns Set of texture paths that need to be loaded
 */
export function collectTexturePaths(shape: ExtrusionShapeV2): Set<string> {
  const paths = new Set<string>()

  // Check default material
  if (shape.defaultMaterial.texturePath) {
    paths.add(shape.defaultMaterial.texturePath)
  }

  // Check per-face materials
  if (shape.faceMaterials) {
    for (const faceId of Object.keys(shape.faceMaterials) as ExtrusionFaceId[]) {
      const faceMat = shape.faceMaterials[faceId]
      if (faceMat?.texturePath) {
        paths.add(faceMat.texturePath)
      }
    }
  }

  return paths
}

/**
 * Generates a unique key for material deduplication
 *
 * @param material The FaceMaterial
 * @returns A string key unique to this material configuration
 */
export function getMaterialKey(material: FaceMaterial): string {
  return JSON.stringify({
    color: material.color,
    texturePath: material.texturePath,
    textureMode: material.textureMode,
    textureRepeat: material.textureRepeat,
    metalness: material.metalness,
    roughness: material.roughness,
  })
}

/**
 * Updates a face material in the shape, returning a new shape with the updated material
 *
 * @param shape The original ExtrusionShapeV2
 * @param faceId The face to update
 * @param updates Partial FaceMaterial updates to apply
 * @returns A new ExtrusionShapeV2 with the updated material
 */
export function updateShapeFaceMaterial(
  shape: ExtrusionShapeV2,
  faceId: ExtrusionFaceId,
  updates: Partial<FaceMaterial>
): ExtrusionShapeV2 {
  const currentMaterial = getEffectiveFaceMaterial(shape, faceId)
  const newMaterial: FaceMaterial = {
    ...currentMaterial,
    ...updates,
  }

  return {
    ...shape,
    faceMaterials: {
      ...shape.faceMaterials,
      [faceId]: newMaterial,
    },
  }
}

/**
 * Creates a simple FaceMaterial with just a color
 *
 * @param color Hex color string
 * @returns A FaceMaterial with the specified color
 */
export function colorMaterial(color: string): FaceMaterial {
  return {
    color,
    metalness: DEFAULT_MATERIAL.metalness,
    roughness: DEFAULT_MATERIAL.roughness,
  }
}

/**
 * Creates a FaceMaterial with a texture
 *
 * @param texturePath URL to the texture image
 * @param mode How to fit the texture ('stretch' or 'tile')
 * @param repeat Repeat counts for tile mode
 * @returns A FaceMaterial with the texture configured
 */
export function textureMaterial(
  texturePath: string,
  mode: 'stretch' | 'tile' = 'stretch',
  repeat?: { x: number; y: number }
): FaceMaterial {
  return {
    color: '#ffffff', // White base so texture shows true colors
    texturePath,
    textureMode: mode,
    textureRepeat: repeat,
    metalness: 0,
    roughness: 0.8,
  }
}

/**
 * Disposes of all materials in an array
 * Call this when unmounting to free GPU memory
 *
 * @param materials Array of materials to dispose
 */
export function disposeMaterials(materials: THREE.Material[]): void {
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) {
      if (material.map) {
        material.map.dispose()
      }
      if (material.normalMap) {
        material.normalMap.dispose()
      }
      if (material.roughnessMap) {
        material.roughnessMap.dispose()
      }
      if (material.metalnessMap) {
        material.metalnessMap.dispose()
      }
    }
    material.dispose()
  }
}
