'use client'

import { PointerEvent, useEffect, useRef, useState } from 'react'
import { describeCell } from './describeCell'
import CellInspector from './CellInspector'
import './MapCanvas.scss'
import { MapStore } from './MapStore'
import { loadAtlas } from './renderer/atlas'
import { MapRenderer } from './renderer/MapRenderer'
import { TileLoader } from './TileLoader'

// The time game ages are counted in is ms, so the fade thresholds are too
const AGING = { fullTicks: 5_000, fadeTicks: 600_000, minAlpha: 0.35 }
const ATLAS_URL = '/atlas/atlas.json'
const CLOCK_INTERVAL_MS = 1000
const LOAD_DELAY_MS = 120
const ZOOM_STEP = 1.15
// A pointer that moves less than this many pixels between press and release is a click, not a drag
const CLICK_DISTANCE = 4

interface Props {
  store: MapStore
  loader: TileLoader
  // The cell to look at first
  center?: { x: number; y: number }
}

export default function MapCanvas({ store, loader, center }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<MapRenderer | null>(null)
  // Asks for the part of the map that is on screen, a moment after the view stopped changing
  const loadVisibleRef = useRef<() => void>(() => undefined)
  // The renderer exists from the first render effect until the component goes away, which is when the handlers run
  const renderer = () => rendererRef.current as MapRenderer
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    const renderer = new MapRenderer(canvas, { aging: AGING })
    rendererRef.current = renderer
    let loadTimer: ReturnType<typeof setTimeout> | undefined
    let isDisposed = false

    const loadVisible = () => {
      clearTimeout(loadTimer)
      loadTimer = setTimeout(() => void loader.ensure(renderer.visibleRange()), LOAD_DELAY_MS)
    }
    loadVisibleRef.current = loadVisible
    const resize = () => {
      const { clientWidth, clientHeight } = canvas
      renderer.resize(clientWidth, clientHeight, window.devicePixelRatio)
      loadVisible()
    }
    const showStore = () => {
      renderer.setNow(store.now())
      renderer.setCells(store.getCells().values())
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()
    showStore()
    const unsubscribe = store.subscribe(showStore)
    const unsubscribeLoader = loader.onInvalidate(loadVisible)
    const clock = setInterval(() => {
      renderer.setNow(store.now())
      setTick((tick) => tick + 1)
    }, CLOCK_INTERVAL_MS)
    void loadAtlas(ATLAS_URL).then((atlas) => !isDisposed && renderer.setAtlas(atlas))

    return () => {
      isDisposed = true
      clearTimeout(loadTimer)
      clearInterval(clock)
      unsubscribe()
      unsubscribeLoader()
      resizeObserver.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [store, loader])

  useEffect(() => {
    if (center) {
      renderer().setCamera({ centerX: center.x + 0.5, centerY: center.y + 0.5, zoom: 1 })
      loadVisibleRef.current()
    }
  }, [center])

  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current
    if (!current) {
      return
    }
    renderer().panBy(event.clientX - current.x, event.clientY - current.y)
    current.x = event.clientX
    current.y = event.clientY
    loadVisibleRef.current()
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const start = drag.current
    drag.current = null
    if (!start || Math.hypot(event.clientX - start.startX, event.clientY - start.startY) > CLICK_DISTANCE) {
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const cell = renderer().cellAt(event.clientX - rect.left, event.clientY - rect.top)
    setSelected(cell)
    renderer().setSelection(cell)
  }

  function onWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    renderer().zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)
    loadVisibleRef.current()
  }

  return (
    <div className="map-canvas" data-testid="map">
      <canvas
        ref={canvasRef}
        className="map-canvas-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />
      {selected && (
        <CellInspector
          x={selected.x}
          y={selected.y}
          description={describeCell(store.getCell(selected.x, selected.y), store.now())}
        />
      )}
    </div>
  )
}
