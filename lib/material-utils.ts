import * as THREE from 'three'
import { MaterialOverride } from '@/types/room'

/**
 * Information about a material extracted from a 3D model
 */
export interface MaterialInfo {
  name: string
  index: number
  originalColor: string // Hex color
  type: string // Material type (MeshStandardMaterial, etc.)
}

/**
 * Extract all materials from a THREE.js scene/group
 * Returns an array of material information
 */
export function extractMaterials(object: THREE.Object3D): MaterialInfo[] {
  const materials: MaterialInfo[] = []
  const seenMaterials = new Set<string>()

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material

      // Handle single material
      if (material && !Array.isArray(material)) {
        const materialKey = material.uuid

        if (!seenMaterials.has(materialKey)) {
          seenMaterials.add(materialKey)

          materials.push({
            name: material.name || `Material ${materials.length + 1}`,
            index: materials.length,
            originalColor: getMaterialColor(material),
            type: material.type
          })
        }
      }

      // Handle array of materials
      if (Array.isArray(material)) {
        material.forEach((mat) => {
          const materialKey = mat.uuid

          if (!seenMaterials.has(materialKey)) {
            seenMaterials.add(materialKey)

            materials.push({
              name: mat.name || `Material ${materials.length + 1}`,
              index: materials.length,
              originalColor: getMaterialColor(mat),
              type: mat.type
            })
          }
        })
      }
    }
  })

  return materials
}

/**
 * Get the color from a material as a hex string
 */
function getMaterialColor(material: THREE.Material): string {
  if ('color' in material && material.color instanceof THREE.Color) {
    return '#' + material.color.getHexString()
  }
  return '#808080' // Default gray
}

/**
 * Apply material overrides to a THREE.js scene/group
 * Clones materials to avoid affecting other instances
 */
export function applyMaterialOverrides(
  object: THREE.Object3D,
  overrides: MaterialOverride[]
): void {
  if (!overrides || overrides.length === 0) return

  // Build a map for quick lookup
  const overrideMap = new Map<string, MaterialOverride>()
  overrides.forEach((override) => {
    if (override.materialName) {
      overrideMap.set(override.materialName, override)
    }
  })

  // Track material indices for unnamed materials
  let materialIndex = 0
  const processedMaterials = new Set<string>()

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material

      // Handle single material
      if (material && !Array.isArray(material)) {
        const materialKey = material.uuid

        if (!processedMaterials.has(materialKey)) {
          processedMaterials.add(materialKey)

          // Find override by name or index
          const override = overrideMap.get(material.name) ||
                          overrides.find(o => o.materialIndex === materialIndex)

          if (override) {
            // Clone the material to avoid affecting other instances
            const clonedMaterial = material.clone()
            applyOverrideToMaterial(clonedMaterial, override)
            child.material = clonedMaterial
          }

          materialIndex++
        }
      }

      // Handle array of materials
      if (Array.isArray(material)) {
        const newMaterials = material.map((mat) => {
          const materialKey = mat.uuid

          if (!processedMaterials.has(materialKey)) {
            processedMaterials.add(materialKey)

            const override = overrideMap.get(mat.name) ||
                            overrides.find(o => o.materialIndex === materialIndex)

            materialIndex++

            if (override) {
              const clonedMaterial = mat.clone()
              applyOverrideToMaterial(clonedMaterial, override)
              return clonedMaterial
            }
          }

          return mat
        })

        child.material = newMaterials
      }
    }
  })
}

/**
 * Apply a single override to a material
 */
function applyOverrideToMaterial(
  material: THREE.Material,
  override: MaterialOverride
): void {
  // Apply base color
  if (override.baseColor && 'color' in material) {
    (material as any).color = new THREE.Color(override.baseColor)
  }

  // Apply metalness (if supported)
  if (override.metalness !== undefined && 'metalness' in material) {
    (material as any).metalness = override.metalness
  }

  // Apply roughness (if supported)
  if (override.roughness !== undefined && 'roughness' in material) {
    (material as any).roughness = override.roughness
  }

  // Mark material as needing update
  material.needsUpdate = true
}

/**
 * Convert a MaterialInfo to a MaterialOverride with current color
 */
export function materialInfoToOverride(info: MaterialInfo): MaterialOverride {
  return {
    materialName: info.name,
    materialIndex: info.index,
    baseColor: info.originalColor
  }
}
