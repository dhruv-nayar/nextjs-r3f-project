'use client'

import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'

interface DimensionLinesProps {
  dimensions: { width: number; height: number; depth: number }
}

/**
 * Format a dimension in feet to feet'inches" format
 */
function formatMeasurement(feet: number): string {
  const wholeFeet = Math.floor(feet)
  const inches = Math.round((feet - wholeFeet) * 12)
  if (inches === 0) return `${wholeFeet}'`
  if (inches === 12) return `${wholeFeet + 1}'`
  return `${wholeFeet}' ${inches}"`
}

/**
 * Single dimension line with end caps and label
 */
function DimensionLine({
  start,
  end,
  color,
  label,
  labelPosition,
}: {
  start: [number, number, number]
  end: [number, number, number]
  color: string
  label: string
  labelPosition: [number, number, number]
}) {
  // Calculate perpendicular direction for end caps
  const direction = useMemo(() => {
    const dir = new THREE.Vector3(
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2]
    ).normalize()
    return dir
  }, [start, end])

  // End cap tick size
  const tickSize = 0.08

  // Create end cap points based on axis
  const endCaps = useMemo(() => {
    const caps: { points: [[number, number, number], [number, number, number]] }[] = []

    // Determine which axis the line is on and create perpendicular ticks
    if (Math.abs(direction.x) > 0.5) {
      // X-axis line (width) - vertical end caps
      caps.push(
        { points: [[start[0], start[1] - tickSize, start[2]], [start[0], start[1] + tickSize, start[2]]] },
        { points: [[end[0], end[1] - tickSize, end[2]], [end[0], end[1] + tickSize, end[2]]] }
      )
    } else if (Math.abs(direction.y) > 0.5) {
      // Y-axis line (height) - horizontal end caps
      caps.push(
        { points: [[start[0] - tickSize, start[1], start[2]], [start[0] + tickSize, start[1], start[2]]] },
        { points: [[end[0] - tickSize, end[1], end[2]], [end[0] + tickSize, end[1], end[2]]] }
      )
    } else {
      // Z-axis line (depth) - horizontal end caps
      caps.push(
        { points: [[start[0] - tickSize, start[1], start[2]], [start[0] + tickSize, start[1], start[2]]] },
        { points: [[end[0] - tickSize, end[1], end[2]], [end[0] + tickSize, end[1], end[2]]] }
      )
    }

    return caps
  }, [start, end, direction, tickSize])

  return (
    <group>
      {/* Main measurement line */}
      <Line
        points={[start, end]}
        color={color}
        lineWidth={2}
      />

      {/* End cap ticks */}
      {endCaps.map((cap, i) => (
        <Line
          key={i}
          points={cap.points}
          color={color}
          lineWidth={2}
        />
      ))}

      {/* Label */}
      <Html
        position={labelPosition}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'ui-monospace, monospace',
            whiteSpace: 'nowrap',
            border: `2px solid ${color}`,
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  )
}

/**
 * DimensionLines - Renders width, height, and depth measurement lines
 *
 * These are rendered in world space (outside the model's rotation group)
 * so they maintain fixed axis alignment regardless of model tilt.
 *
 * The model is normalized to fit within ~2 units, centered at origin,
 * with ground offset lifting it so the bottom is at Y=0.
 */
export function DimensionLines({ dimensions }: DimensionLinesProps) {
  // Model is normalized to ~2 units across the largest dimension
  // We position lines slightly outside this normalized space
  const MARGIN = 0.4
  const MODEL_HALF = 1.0 // Half of the normalized model size

  // Colors matching standard axis conventions
  const colors = {
    width: '#ef4444',  // Red for X
    height: '#22c55e', // Green for Y
    depth: '#3b82f6',  // Blue for Z
  }

  return (
    <group>
      {/* Width line (X-axis) - horizontal, below the model */}
      <DimensionLine
        start={[-MODEL_HALF, -MARGIN, 0]}
        end={[MODEL_HALF, -MARGIN, 0]}
        color={colors.width}
        label={formatMeasurement(dimensions.width)}
        labelPosition={[0, -MARGIN - 0.15, 0]}
      />

      {/* Height line (Y-axis) - vertical, to the right of the model */}
      <DimensionLine
        start={[MODEL_HALF + MARGIN, 0, 0]}
        end={[MODEL_HALF + MARGIN, 2, 0]}
        color={colors.height}
        label={formatMeasurement(dimensions.height)}
        labelPosition={[MODEL_HALF + MARGIN + 0.2, 1, 0]}
      />

      {/* Depth line (Z-axis) - front to back, below the model */}
      <DimensionLine
        start={[MODEL_HALF + MARGIN, -MARGIN, -MODEL_HALF]}
        end={[MODEL_HALF + MARGIN, -MARGIN, MODEL_HALF]}
        color={colors.depth}
        label={formatMeasurement(dimensions.depth)}
        labelPosition={[MODEL_HALF + MARGIN + 0.2, -MARGIN, 0]}
      />
    </group>
  )
}
