/**
 * GLOBAL SCALE SYSTEM
 *
 * This project uses a consistent scale across all components:
 *
 * 1 THREE.JS UNIT = 1 FOOT (real world)
 *
 * When creating models in Blender or other 3D software:
 * - Set your units to feet
 * - A 3ft x 2ft table should be modeled as 3 x 2 units
 *
 * For floorplans:
 * - Upload your floorplan image
 * - Specify the real-world dimensions (e.g., 30ft x 40ft)
 * - The system will calculate the pixel-to-foot ratio automatically
 *
 * Example conversions:
 * - 1 inch = 0.0833 units
 * - 12 inches = 1 unit (1 foot)
 * - 1 meter = 3.28084 units
 */

export const SCALE = {
  // Base unit: 1 unit = 1 foot
  UNIT_TO_FEET: 1,
  FEET_TO_UNIT: 1,

  // Conversions
  INCHES_TO_UNIT: 1 / 12,  // 0.0833
  UNIT_TO_INCHES: 12,

  METERS_TO_UNIT: 3.28084,
  UNIT_TO_METERS: 0.3048,

  // Common furniture heights (in units/feet)
  FURNITURE_HEIGHTS: {
    TABLE: 2.5,        // 2.5 feet / 30 inches
    CHAIR: 3,          // 3 feet / 36 inches
    COUNTER: 3,        // 3 feet / 36 inches
    DESK: 2.5,         // 2.5 feet / 30 inches
    BED: 2,            // 2 feet / 24 inches
    SOFA: 2.5,         // 2.5 feet / 30 inches
    CABINET: 6,        // 6 feet / 72 inches
    BOOKSHELF: 6,      // 6 feet / 72 inches
  },

  // Camera settings
  CAMERA: {
    DEFAULT_HEIGHT: 5.5,     // 5.5 feet (eye level)
    DEFAULT_DISTANCE: 20,    // 20 feet from target
    MIN_DISTANCE: 3,         // 3 feet minimum (closer zoom in)
    MAX_DISTANCE: 100,       // 100 feet maximum (further zoom out)
  }
} as const

export const FLOORPLAN = {
  // Default pixel density for floorplans
  // This will be overridden when user uploads with dimensions
  DEFAULT_PIXELS_PER_FOOT: 20,

  // Maximum floorplan size (in feet)
  MAX_WIDTH_FEET: 100,
  MAX_HEIGHT_FEET: 100,

  // Floorplan display height above ground
  GROUND_OFFSET: 0.01,
} as const

export const GRID = {
  // Grid settings (in feet)
  SIZE: 50,           // 50 feet x 50 feet grid
  DIVISIONS: 50,      // 1 foot per division
  COLOR_CENTER: '#888888',
  COLOR_GRID: '#444444',
} as const
