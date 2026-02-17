/**
 * Measurement parsing and formatting utilities
 * Supports flexible input formats for feet and inches
 */

export interface ParseResult {
  success: boolean
  feet: number
  error?: string
}

/**
 * Parse a measurement string into decimal feet
 *
 * Supported formats:
 * - 5'6" or 5' 6" (feet and inches with quotes)
 * - 5ft 6in or 5 ft 6 in (feet and inches with words)
 * - 5.5 ft or 5.5' (decimal feet)
 * - 66" or 66 in (inches only)
 * - 5.5 (plain number, defaults to feet)
 */
export function parseMeasurement(input: string): ParseResult {
  const trimmed = input.trim().toLowerCase()

  if (!trimmed) {
    return { success: false, feet: 0, error: 'Empty input' }
  }

  // Pattern 1: X'Y" or X' Y" or X′Y″ (feet and inches with quotes)
  // Matches: 5'6", 5' 6", 5'6, 5' 6
  const ftInQuoteMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*['′]\s*(\d+(?:\.\d+)?)\s*["″]?$/)
  if (ftInQuoteMatch) {
    const feet = parseFloat(ftInQuoteMatch[1])
    const inches = parseFloat(ftInQuoteMatch[2])
    return { success: true, feet: feet + inches / 12 }
  }

  // Pattern 2: X ft Y in or Xft Yin (with words)
  // Matches: 5ft 6in, 5 ft 6 in, 5feet 6inches, 5 feet 6 inches
  const ftInWordMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot)\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches)?$/)
  if (ftInWordMatch) {
    const feet = parseFloat(ftInWordMatch[1])
    const inches = parseFloat(ftInWordMatch[2])
    return { success: true, feet: feet + inches / 12 }
  }

  // Pattern 3: X' or X ft (feet only with unit)
  // Matches: 5', 5.5', 5ft, 5.5 ft, 5 feet
  const ftOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:['′]|ft|feet|foot)$/)
  if (ftOnlyMatch) {
    return { success: true, feet: parseFloat(ftOnlyMatch[1]) }
  }

  // Pattern 4: X" or X in (inches only)
  // Matches: 66", 66in, 66 in, 66 inches
  const inOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:["″]|in|inch|inches)$/)
  if (inOnlyMatch) {
    return { success: true, feet: parseFloat(inOnlyMatch[1]) / 12 }
  }

  // Pattern 5: Plain number (default to feet)
  // Matches: 5, 5.5, 10.25
  const numberMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/)
  if (numberMatch) {
    return { success: true, feet: parseFloat(numberMatch[1]) }
  }

  return { success: false, feet: 0, error: 'Invalid format' }
}

/**
 * Format decimal feet for display
 *
 * @param feet - Value in decimal feet
 * @param format - 'imperial' for "5' 6\"" or 'decimal' for "5.50 ft"
 * @returns Formatted string
 */
export function formatFeetForDisplay(feet: number, format: 'imperial' | 'decimal' = 'imperial'): string {
  if (format === 'decimal') {
    return `${feet.toFixed(2)} ft`
  }

  // Handle negative values
  const sign = feet < 0 ? '-' : ''
  const absFeet = Math.abs(feet)

  const wholeFeet = Math.floor(absFeet)
  const remainingInches = (absFeet - wholeFeet) * 12

  // Round to nearest 0.5 inch for cleaner display
  const roundedInches = Math.round(remainingInches * 2) / 2

  // If inches rounded up to 12, add to feet
  if (roundedInches >= 12) {
    return `${sign}${wholeFeet + 1}'`
  }

  if (roundedInches === 0) {
    return `${sign}${wholeFeet}'`
  }

  if (wholeFeet === 0) {
    // Format inches: show .5 but not .0
    const inchesStr = roundedInches % 1 === 0 ? roundedInches.toFixed(0) : roundedInches.toFixed(1)
    return `${sign}${inchesStr}"`
  }

  // Format inches: show .5 but not .0
  const inchesStr = roundedInches % 1 === 0 ? roundedInches.toFixed(0) : roundedInches.toFixed(1)
  return `${sign}${wholeFeet}' ${inchesStr}"`
}

/**
 * Convert inches to feet
 */
export function inchesToFeet(inches: number): number {
  return inches / 12
}

/**
 * Convert feet to inches
 */
export function feetToInches(feet: number): number {
  return feet * 12
}
