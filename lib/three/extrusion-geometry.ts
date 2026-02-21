import * as THREE from 'three'
import { ExtrusionShapeV2, ExtrusionFaceId } from '@/types/room'

/**
 * Creates an ExtrudeGeometry with separate material groups for each face.
 *
 * Material indices:
 * - 0: top cap (front face after rotation)
 * - 1: bottom cap (back face after rotation)
 * - 2 to N+1: side faces (one per polygon edge)
 *
 * @param shape The ExtrusionShapeV2 data
 * @returns BufferGeometry with per-face material groups
 */
export function createPerFaceExtrusionGeometry(shape: ExtrusionShapeV2): THREE.BufferGeometry {
  if (!shape.points || shape.points.length < 3) {
    // Fallback to a simple box if not enough points
    const geometry = new THREE.BoxGeometry(1, shape.height, 1)
    // Box geometry already has 6 material groups (one per face)
    return geometry
  }

  const numEdges = shape.points.length

  // Create a 2D shape from the polygon points
  const threeShape = new THREE.Shape()
  threeShape.moveTo(shape.points[0].x, shape.points[0].y)
  for (let i = 1; i < shape.points.length; i++) {
    threeShape.lineTo(shape.points[i].x, shape.points[i].y)
  }
  threeShape.lineTo(shape.points[0].x, shape.points[0].y)

  // Create the extruded geometry
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: shape.height,
    bevelEnabled: false,
  }
  const geometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings)

  // Rotate to have extrusion go upward (Y-axis instead of Z-axis)
  geometry.rotateX(-Math.PI / 2)

  // Get the position and normal attributes
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute

  // Clear existing groups
  geometry.clearGroups()

  // Categorize each triangle by its face type
  const triangleCount = posAttr.count / 3

  interface FaceGroup {
    faceId: ExtrusionFaceId
    materialIndex: number
    triangleIndices: number[]
  }

  const faceGroups: Map<string, FaceGroup> = new Map()

  // Initialize face groups
  // Index 0 = top, Index 1 = bottom, Index 2+ = sides
  faceGroups.set('top', { faceId: 'top', materialIndex: 0, triangleIndices: [] })
  faceGroups.set('bottom', { faceId: 'bottom', materialIndex: 1, triangleIndices: [] })
  for (let i = 0; i < numEdges; i++) {
    faceGroups.set(`side-${i}`, { faceId: `side-${i}`, materialIndex: 2 + i, triangleIndices: [] })
  }

  // Analyze each triangle to determine which face it belongs to
  for (let triIdx = 0; triIdx < triangleCount; triIdx++) {
    const baseVertex = triIdx * 3

    // Get the average position and normal of this triangle
    const avgPos = new THREE.Vector3()
    const avgNormal = new THREE.Vector3()

    for (let v = 0; v < 3; v++) {
      const idx = baseVertex + v
      avgPos.x += posAttr.getX(idx)
      avgPos.y += posAttr.getY(idx)
      avgPos.z += posAttr.getZ(idx)
      avgNormal.x += normalAttr.getX(idx)
      avgNormal.y += normalAttr.getY(idx)
      avgNormal.z += normalAttr.getZ(idx)
    }
    avgPos.divideScalar(3)
    avgNormal.divideScalar(3).normalize()

    // Determine face type based on normal direction
    // After rotation: Y-up is the extrusion direction
    const upThreshold = 0.9
    const downThreshold = -0.9

    if (avgNormal.y > upThreshold) {
      // Top cap (pointing up)
      faceGroups.get('top')!.triangleIndices.push(triIdx)
    } else if (avgNormal.y < downThreshold) {
      // Bottom cap (pointing down)
      faceGroups.get('bottom')!.triangleIndices.push(triIdx)
    } else {
      // Side face - determine which edge based on the normal direction in XZ plane
      const sideNormal = new THREE.Vector2(avgNormal.x, avgNormal.z).normalize()

      // Find which polygon edge this normal corresponds to
      let bestEdge = 0
      let bestDot = -Infinity

      for (let i = 0; i < numEdges; i++) {
        const p1 = shape.points[i]
        const p2 = shape.points[(i + 1) % numEdges]

        // Edge direction (in original 2D space, which maps to XZ after rotation)
        const edgeDir = new THREE.Vector2(p2.x - p1.x, p2.y - p1.y)

        // Normal to the edge (perpendicular, pointing outward)
        // For a CCW polygon, the outward normal is (dy, -dx)
        const edgeNormal = new THREE.Vector2(edgeDir.y, -edgeDir.x).normalize()

        const dot = sideNormal.dot(edgeNormal)
        if (dot > bestDot) {
          bestDot = dot
          bestEdge = i
        }
      }

      faceGroups.get(`side-${bestEdge}`)!.triangleIndices.push(triIdx)
    }
  }

  // Now we need to reorder the geometry so triangles are grouped by face
  // and create proper groups

  // Collect all triangles in order: top, bottom, side-0, side-1, ...
  const orderedTriangles: number[] = []
  const groupOrder = ['top', 'bottom', ...Array.from({ length: numEdges }, (_, i) => `side-${i}`)]

  for (const groupKey of groupOrder) {
    const group = faceGroups.get(groupKey)!
    orderedTriangles.push(...group.triangleIndices)
  }

  // Create new attribute arrays with reordered triangles
  const newPositions = new Float32Array(posAttr.count * 3)
  const newNormals = new Float32Array(normalAttr.count * 3)

  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
  const newUvs = uvAttr ? new Float32Array(uvAttr.count * 2) : undefined

  let newVertexIdx = 0
  for (const triIdx of orderedTriangles) {
    const baseVertex = triIdx * 3
    for (let v = 0; v < 3; v++) {
      const oldIdx = baseVertex + v

      newPositions[newVertexIdx * 3] = posAttr.getX(oldIdx)
      newPositions[newVertexIdx * 3 + 1] = posAttr.getY(oldIdx)
      newPositions[newVertexIdx * 3 + 2] = posAttr.getZ(oldIdx)

      newNormals[newVertexIdx * 3] = normalAttr.getX(oldIdx)
      newNormals[newVertexIdx * 3 + 1] = normalAttr.getY(oldIdx)
      newNormals[newVertexIdx * 3 + 2] = normalAttr.getZ(oldIdx)

      if (uvAttr && newUvs) {
        newUvs[newVertexIdx * 2] = uvAttr.getX(oldIdx)
        newUvs[newVertexIdx * 2 + 1] = uvAttr.getY(oldIdx)
      }

      newVertexIdx++
    }
  }

  // Replace attributes
  geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3))
  if (newUvs) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(newUvs, 2))
  }

  // Add groups based on reordered triangles
  let startVertex = 0
  for (const groupKey of groupOrder) {
    const group = faceGroups.get(groupKey)!
    const vertexCount = group.triangleIndices.length * 3
    if (vertexCount > 0) {
      geometry.addGroup(startVertex, vertexCount, group.materialIndex)
      startVertex += vertexCount
    }
  }

  // Center the geometry at its bounding box center (XZ only, keep Y at floor)
  geometry.computeBoundingBox()
  const boundingBox = geometry.boundingBox!
  const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
  const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2
  geometry.translate(-centerX, 0, -centerZ)

  return geometry
}

/**
 * Maps a material index to a face ID
 *
 * @param materialIndex The material index from the geometry group
 * @param numEdges Number of polygon edges
 * @returns The face ID string
 */
export function materialIndexToFaceId(materialIndex: number, numEdges: number): ExtrusionFaceId {
  if (materialIndex === 0) return 'top'
  if (materialIndex === 1) return 'bottom'
  const sideIndex = materialIndex - 2
  if (sideIndex >= 0 && sideIndex < numEdges) {
    return `side-${sideIndex}`
  }
  return 'top' // Fallback
}

/**
 * Maps a face ID to a material index
 *
 * @param faceId The face ID string
 * @returns The material index
 */
export function faceIdToMaterialIndex(faceId: ExtrusionFaceId): number {
  if (faceId === 'top') return 0
  if (faceId === 'bottom') return 1
  // Parse side-N format
  const match = faceId.match(/^side-(\d+)$/)
  if (match) {
    return 2 + parseInt(match[1], 10)
  }
  return 0 // Fallback
}

/**
 * Gets all face IDs for a shape with the given number of polygon points
 *
 * @param numPoints Number of points in the polygon
 * @returns Array of all face IDs
 */
export function getAllFaceIds(numPoints: number): ExtrusionFaceId[] {
  const faceIds: ExtrusionFaceId[] = ['top', 'bottom']
  for (let i = 0; i < numPoints; i++) {
    faceIds.push(`side-${i}`)
  }
  return faceIds
}

/**
 * Gets the total number of material slots needed for a shape
 *
 * @param numPoints Number of points in the polygon
 * @returns Number of materials needed (2 caps + N sides)
 */
export function getMaterialCount(numPoints: number): number {
  return 2 + numPoints // top, bottom, and one per side
}
