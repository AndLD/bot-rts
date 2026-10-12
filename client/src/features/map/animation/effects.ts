import { clamp01, Effect, Painter, seeded } from './painter'

interface Spot {
  x: number
  y: number
}

const center = (painter: Painter, spot: Spot) => {
  const corner = painter.cellToScreen(spot.x, spot.y)

  return { x: corner.x + painter.cellSize / 2, y: corner.y + painter.cellSize / 2 }
}

function fade(context: CanvasRenderingContext2D, alpha: number, paint: () => void) {
  context.save()
  context.globalAlpha = clamp01(alpha)
  paint()
  context.restore()
}

// A tracer from the shooter to the target with a flash at the muzzle and a spark where it lands (design §15.2)
export function shot(startedAt: number, from: Spot, to: Spot): Effect {
  return {
    startedAt,
    durationMs: 220,
    draw(painter, progress) {
      const { context } = painter
      const [start, end] = [center(painter, from), center(painter, to)]

      fade(context, 1 - progress, () => {
        context.strokeStyle = '#fde047'
        context.lineWidth = Math.max(1, painter.cellSize / 14)
        context.beginPath()
        context.moveTo(start.x, start.y)
        context.lineTo(end.x, end.y)
        context.stroke()
        context.fillStyle = '#fff7ae'
        context.beginPath()
        context.arc(start.x, start.y, painter.cellSize * 0.3 * (1 - progress), 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#fb923c'
        context.beginPath()
        context.arc(end.x, end.y, painter.cellSize * 0.35 * progress, 0, Math.PI * 2)
        context.fill()
      })
    }
  }
}

// A damage number that floats up from the victim
export function floatingText(startedAt: number, at: Spot, text: string, color: string): Effect {
  return {
    startedAt,
    durationMs: 800,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = center(painter, at)

      fade(context, 1 - progress, () => {
        context.fillStyle = color
        context.font = `bold ${Math.max(10, painter.cellSize * 0.5)}px sans-serif`
        context.fillText(text, x, y - painter.cellSize * (0.3 + progress))
      })
    }
  }
}

// Dust thrown up by a drill
export function dust(startedAt: number, at: Spot, seed: number): Effect {
  return {
    startedAt,
    durationMs: 450,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = center(painter, at)

      fade(context, 1 - progress, () => {
        context.fillStyle = '#a8a29e'
        for (let particle = 0; particle < 6; particle++) {
          const angle = seeded(seed, particle) * Math.PI * 2
          const reach = painter.cellSize * (0.2 + 0.5 * progress) * (0.5 + seeded(seed, particle + 10))
          context.beginPath()
          context.arc(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, painter.cellSize * 0.06, 0, Math.PI * 2)
          context.fill()
        }
      })
    }
  }
}

// A ring that grows from a cell: the radar pulse of a scan, the pop of a depleted deposit, the pulse of a link
export function ring(startedAt: number, at: Spot, cells: number, color: string, durationMs = 700): Effect {
  return {
    startedAt,
    durationMs,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = center(painter, at)

      fade(context, 1 - progress, () => {
        context.strokeStyle = color
        context.lineWidth = Math.max(1, painter.cellSize / 12)
        context.beginPath()
        context.arc(x, y, painter.cellSize * (0.3 + cells * progress), 0, Math.PI * 2)
        context.stroke()
      })
    }
  }
}

// Smoke that rises from a broken module
export function smoke(startedAt: number, at: Spot, seed: number): Effect {
  return {
    startedAt,
    durationMs: 1100,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = center(painter, at)

      fade(context, 0.7 * (1 - progress), () => {
        context.fillStyle = '#52525b'
        for (let puff = 0; puff < 4; puff++) {
          const drift = (seeded(seed, puff) - 0.5) * painter.cellSize * 0.6
          context.beginPath()
          context.arc(
            x + drift,
            y - painter.cellSize * (0.2 + progress * (0.6 + puff * 0.1)),
            painter.cellSize * (0.12 + 0.1 * progress),
            0,
            Math.PI * 2
          )
          context.fill()
        }
      })
    }
  }
}

// A flash over a cell, for damage
export function flash(startedAt: number, at: Spot, color: string): Effect {
  return {
    startedAt,
    durationMs: 250,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = painter.cellToScreen(at.x, at.y)

      fade(context, 0.6 * (1 - progress), () => {
        context.fillStyle = color
        context.fillRect(x, y, painter.cellSize, painter.cellSize)
      })
    }
  }
}

// A slow blink of the energy icon over a bot (design §15.2)
export function lowEnergy(startedAt: number, at: Spot): Effect {
  return {
    startedAt,
    durationMs: 3000,
    draw(painter, progress) {
      const { context } = painter
      const { x, y } = center(painter, at)
      const isLit = Math.floor(progress * 6) % 2 === 0

      if (isLit) {
        context.fillStyle = '#facc15'
        context.font = `bold ${Math.max(10, painter.cellSize * 0.6)}px sans-serif`
        context.fillText('⚡', x - painter.cellSize * 0.2, y - painter.cellSize * 0.6)
      }
    }
  }
}

// The plain stand-in for any effect when motion is reduced: a still outline on the cell for a moment
export function highlight(startedAt: number, at: Spot, color: string): Effect {
  return {
    startedAt,
    durationMs: 600,
    draw(painter) {
      const { context } = painter
      const { x, y } = painter.cellToScreen(at.x, at.y)

      context.save()
      context.strokeStyle = color
      context.lineWidth = 2
      context.strokeRect(x + 1, y + 1, painter.cellSize - 2, painter.cellSize - 2)
      context.restore()
    }
  }
}
