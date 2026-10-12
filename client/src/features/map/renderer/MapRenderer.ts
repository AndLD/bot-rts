import { AnimationSystem } from '../animation/AnimationSystem'
import { Atlas } from './atlas'
import { ageAlpha, AgingOptions, DEFAULT_AGING } from './aging'
import { cellPixels, LOD_ZOOM, panBy, screenToCell, TILE_SIZE, visibleRange, worldToScreen, zoomAt } from './camera'
import { Camera, cellKey, MapCell, MapLink, Size } from './model'
import { colorOf, PALETTE, tintOf } from './palette'
import { isGhost, layersOf } from './sprites'

export interface MapRendererOptions {
  atlas?: Atlas | null
  // The animations to play over the map, driven by game events (design §15.2)
  animations?: AnimationSystem
  aging?: AgingOptions
  // Draws on a scratch canvas to tint a sprite by ownership
  createScratch?: () => HTMLCanvasElement
  schedule?: (callback: () => void) => number
  cancel?: (handle: number) => void
}

const TINT_ALPHA = 0.45
const HATCH_SPACING = 6

// Draws the map on a Canvas 2D (design §4.3). Framework-free: the owner feeds it cells, a clock and a camera, and
// asks for a frame; the same renderer serves the game map and the ambient scene of the landing page.
export class MapRenderer {
  private readonly context: CanvasRenderingContext2D
  private readonly aging: AgingOptions
  private readonly createScratch: () => HTMLCanvasElement
  private readonly schedule: (callback: () => void) => number
  private readonly cancel: (handle: number) => void
  private cells = new Map<string, MapCell>()
  private links: MapLink[] = []
  private atlas: Atlas | null
  private readonly animations: AnimationSystem | null
  private size: Size = { width: 0, height: 0 }
  private camera: Camera = { centerX: 0, centerY: 0, zoom: 1 }
  private now = 0
  private selected: { x: number; y: number } | null = null
  private isShowingLinks = false
  private frame: number | null = null

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: MapRendererOptions = {}
  ) {
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas 2D is not available')
    }

    this.context = context
    this.atlas = options.atlas ?? null
    this.animations = options.animations ?? null
    this.aging = options.aging ?? DEFAULT_AGING
    this.createScratch = options.createScratch ?? (() => document.createElement('canvas'))
    this.schedule = options.schedule ?? ((callback) => requestAnimationFrame(callback))
    this.cancel = options.cancel ?? ((handle) => cancelAnimationFrame(handle))
  }

  setAtlas(atlas: Atlas | null) {
    this.atlas = atlas
    this.requestRender()
  }

  setCells(cells: Iterable<MapCell>) {
    this.cells = new Map()
    for (const cell of cells) {
      this.cells.set(cellKey(cell.x, cell.y), cell)
    }
    this.requestRender()
  }

  // Applies a batch of changed cells to what is shown
  updateCells(cells: Iterable<MapCell>) {
    for (const cell of cells) {
      this.cells.set(cellKey(cell.x, cell.y), cell)
    }
    this.requestRender()
  }

  setLinks(links: MapLink[]) {
    this.links = links
    this.requestRender()
  }

  setLinksVisible(isVisible: boolean) {
    this.isShowingLinks = isVisible
    this.requestRender()
  }

  // The current game tick, which the age of the snapshots is counted from
  setNow(tick: number) {
    this.now = tick
    this.requestRender()
  }

  setSelection(cell: { x: number; y: number } | null) {
    this.selected = cell
    this.requestRender()
  }

  setCamera(camera: Camera) {
    this.camera = camera
    this.requestRender()
  }

  getCamera() {
    return this.camera
  }

  getSize() {
    return this.size
  }

  resize(width: number, height: number, pixelRatio = 1) {
    this.size = { width, height }
    this.canvas.width = Math.round(width * pixelRatio)
    this.canvas.height = Math.round(height * pixelRatio)
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    this.requestRender()
  }

  panBy(dxPixels: number, dyPixels: number) {
    this.setCamera(panBy(this.camera, dxPixels, dyPixels))
  }

  zoomAt(px: number, py: number, factor: number) {
    this.setCamera(zoomAt(this.camera, this.size, px, py, factor))
  }

  cellAt(px: number, py: number) {
    return screenToCell(this.camera, this.size, px, py)
  }

  cellData(x: number, y: number) {
    return this.cells.get(cellKey(x, y))
  }

  // The cells in view, for the owner to ask the server for what is missing
  visibleRange() {
    return visibleRange(this.camera, this.size)
  }

  requestRender() {
    if (this.frame === null) {
      this.frame = this.schedule(() => {
        this.frame = null
        this.render()
      })
    }
  }

  dispose() {
    if (this.frame !== null) {
      this.cancel(this.frame)
      this.frame = null
    }
  }

  render() {
    const { context, size } = this
    const isCoarse = this.camera.zoom < LOD_ZOOM

    context.fillStyle = PALETTE.fog
    context.fillRect(0, 0, size.width, size.height)

    const range = visibleRange(this.camera, size)
    for (let y = range.minY; y <= range.maxY; y++) {
      for (let x = range.minX; x <= range.maxX; x++) {
        const cell = this.cells.get(cellKey(x, y))
        if (cell) {
          this.drawCell(cell, isCoarse)
        }
      }
    }

    if (this.isShowingLinks) {
      this.drawLinks()
    }
    // Effects are not drawn at low zoom, where they could not be seen, but a move already under way finishes
    const isAnimating = this.animations?.draw({
      context,
      cellToScreen: (x, y) => worldToScreen(this.camera, size, x, y),
      cellSize: cellPixels(this.camera)
    })
    if (this.selected) {
      this.outline(this.selected.x, this.selected.y, PALETTE.selection, 2)
    }
    // Something is still moving: the next frame follows at once
    if (isAnimating) {
      this.requestRender()
    }
  }

  private drawCell(cell: MapCell, isCoarse: boolean) {
    const { context } = this
    const { content } = cell
    const scale = cellPixels(this.camera)
    const shift = this.animations?.moveOffset(cell.x, cell.y)
    const { x, y } = worldToScreen(this.camera, this.size, cell.x + (shift?.dx ?? 0), cell.y + (shift?.dy ?? 0))
    const isLost = content.kind === 'bot' && content.linkLostAt !== undefined
    const ghost = isGhost(cell)

    context.save()
    context.globalAlpha = cell.isLive ? 1 : ageAlpha(this.now - cell.seenAt, this.aging) * (ghost ? 0.6 : 1)

    const isDrawn = !isCoarse && this.drawSprites(cell, x, y, scale)
    if (!isDrawn) {
      context.fillStyle = colorOf(content)
      context.fillRect(x, y, scale, scale)
    }

    if (content.kind === 'bot' && content.isStale) {
      context.globalAlpha = 0.55
      context.fillStyle = '#71717a'
      context.fillRect(x, y, scale, scale)
    }
    if (isLost) {
      this.hatch(x, y, scale)
    }
    if (ghost) {
      context.setLineDash([3, 3])
      context.strokeStyle = '#e4e4e7'
      context.lineWidth = 1
      context.strokeRect(x + 0.5, y + 0.5, scale - 1, scale - 1)
    }
    context.restore()

    if (cell.isLive) {
      this.outline(cell.x, cell.y, PALETTE.liveOutline, 1)
    }
    if (!isCoarse && content.kind === 'bot' && content.signal !== undefined && !isLost) {
      this.signalBars(content.signal, x, y, scale)
    }
  }

  // Draws the sprites of a cell; false when the atlas lacks the base sprite (the colour fallback is drawn instead)
  private drawSprites(cell: MapCell, x: number, y: number, scale: number) {
    const atlas = this.atlas
    if (!atlas) {
      return false
    }

    const layers = layersOf(cell.content)
    const base = atlas.frame(layers.base)
    if (!base) {
      return false
    }

    if (cell.content.kind !== 'empty') {
      const ground = atlas.frame('ground')
      if (ground) {
        this.blit(atlas, ground, x, y, scale)
      }
    }

    const tint = tintOf(cell.content)
    const sprites = [layers.base, ...layers.overlays].flatMap((name) => {
      const frame = atlas.frame(name)
      return frame ? [frame] : []
    })

    if (tint) {
      this.drawTinted(atlas, sprites[0], tint, x, y, scale)
      for (const frame of sprites.slice(1)) {
        this.blit(atlas, frame, x, y, scale)
      }
    } else {
      for (const frame of sprites) {
        this.blit(atlas, frame, x, y, scale)
      }
    }

    return true
  }

  private blit(
    atlas: Atlas,
    frame: { x: number; y: number; w: number; h: number },
    x: number,
    y: number,
    scale: number
  ) {
    this.context.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, x, y, scale, scale)
  }

  // The ownership tint is drawn over the opaque pixels of the sprite only
  private drawTinted(
    atlas: Atlas,
    frame: { x: number; y: number; w: number; h: number },
    tint: string,
    x: number,
    y: number,
    scale: number
  ) {
    const scratch = this.createScratch()
    scratch.width = TILE_SIZE
    scratch.height = TILE_SIZE
    const tintContext = scratch.getContext('2d')

    if (!tintContext) {
      this.blit(atlas, frame, x, y, scale)
      return
    }

    tintContext.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    tintContext.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, 0, 0, TILE_SIZE, TILE_SIZE)
    tintContext.globalCompositeOperation = 'source-atop'
    tintContext.globalAlpha = TINT_ALPHA
    tintContext.fillStyle = tint
    tintContext.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    this.context.drawImage(scratch, x, y, scale, scale)
  }

  // Diagonal grey hatching over a bot without a radio link (design §11.2.1)
  private hatch(x: number, y: number, scale: number) {
    const { context } = this

    context.globalAlpha = 0.7
    context.fillStyle = '#52525b'
    context.fillRect(x, y, scale, scale)
    context.beginPath()
    context.rect(x, y, scale, scale)
    context.clip()
    context.strokeStyle = '#d4d4d8'
    context.lineWidth = 1
    context.beginPath()
    for (let offset = -scale; offset < scale; offset += HATCH_SPACING) {
      context.moveTo(x + offset, y + scale)
      context.lineTo(x + offset + scale, y)
    }
    context.stroke()
  }

  private signalBars(signal: number, x: number, y: number, scale: number) {
    const { context } = this
    const bars = 4
    const width = Math.max(1, scale / 12)
    const color = PALETTE.signal[Math.max(0, Math.min(bars, signal))]

    for (let bar = 0; bar < bars; bar++) {
      const height = (scale / 4) * ((bar + 1) / bars) + 1
      context.fillStyle = bar < signal ? color : 'rgba(0, 0, 0, 0.55)'
      context.fillRect(x + scale - (bars - bar) * (width + 1) - 1, y + scale - height - 1, width, height)
    }
  }

  private outline(cellX: number, cellY: number, color: string, lineWidth: number) {
    const { x, y } = worldToScreen(this.camera, this.size, cellX, cellY)
    const scale = cellPixels(this.camera)

    this.context.save()
    this.context.strokeStyle = color
    this.context.lineWidth = lineWidth
    this.context.strokeRect(x + lineWidth / 2, y + lineWidth / 2, scale - lineWidth, scale - lineWidth)
    this.context.restore()
  }

  private drawLinks() {
    const { context } = this

    context.save()
    context.lineWidth = 1.5
    context.setLineDash([4, 4])
    for (const link of this.links) {
      const from = worldToScreen(this.camera, this.size, link.from.x + 0.5, link.from.y + 0.5)
      const to = worldToScreen(this.camera, this.size, link.to.x + 0.5, link.to.y + 0.5)
      context.strokeStyle = link.isBroken ? PALETTE.brokenLink : PALETTE.link
      context.beginPath()
      context.moveTo(from.x, from.y)
      context.lineTo(to.x, to.y)
      context.stroke()
    }
    context.restore()
  }
}
