import * as THREE from 'three'

/**
 * Camera configuration for consistent overhead views
 */
export const OVERHEAD_CAMERA_CONFIG = {
  /** Elevation angle in degrees (70 = looking down from above) */
  elevationDegrees: 70,
  /** Azimuth angle in degrees (45 = looking from corner) */
  azimuthDegrees: 45,
  /** Distance multiplier relative to scene size */
  distanceMultiplier: 1.8,
  /** Default FOV for the view */
  fov: 50,
}

export interface CameraPosition {
  position: THREE.Vector3
  target: THREE.Vector3
}

/**
 * Calculate the optimal overhead camera position to fit the entire scene.
 * Used for both thumbnail capture and default camera placement.
 *
 * @param scene - The Three.js scene to calculate bounds from
 * @returns Camera position and target, or null if scene is empty
 */
export function calculateOverheadCameraPosition(scene: THREE.Scene): CameraPosition | null {
  // Calculate bounding box of the entire scene
  const boundingBox = new THREE.Box3()

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const objectBox = new THREE.Box3().setFromObject(object)
      boundingBox.union(objectBox)
    }
  })

  // Check if we have valid bounds
  if (boundingBox.isEmpty()) {
    return null
  }

  // Get center and size of the scene
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  boundingBox.getCenter(center)
  boundingBox.getSize(size)

  // Calculate the maximum dimension to determine camera distance
  const maxDim = Math.max(size.x, size.y, size.z)
  const effectiveMaxDim = maxDim > 1 ? maxDim : 30

  // Convert angles to radians
  const elevation = (OVERHEAD_CAMERA_CONFIG.elevationDegrees * Math.PI) / 180
  const azimuth = (OVERHEAD_CAMERA_CONFIG.azimuthDegrees * Math.PI) / 180

  // Calculate distance to fit scene in view
  const distance = effectiveMaxDim * OVERHEAD_CAMERA_CONFIG.distanceMultiplier

  // Calculate camera position using spherical coordinates
  const cameraX = center.x + distance * Math.cos(elevation) * Math.sin(azimuth)
  const cameraY = center.y + distance * Math.sin(elevation)
  const cameraZ = center.z + distance * Math.cos(elevation) * Math.cos(azimuth)

  return {
    position: new THREE.Vector3(cameraX, cameraY, cameraZ),
    target: center.clone(),
  }
}

/**
 * Default camera position when scene is empty or not yet loaded
 */
export const DEFAULT_CAMERA_POSITION: CameraPosition = {
  position: new THREE.Vector3(30, 35, 40),
  target: new THREE.Vector3(0, 0, 0),
}
