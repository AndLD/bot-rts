'use client'

import { useEffect, useRef } from 'react'
import { AnimationSystem } from '../map/animation/AnimationSystem'
import { useSystemReducedMotion } from '../map/useSystemReducedMotion'
import { loadAtlas } from '../map/renderer/atlas'
import { MapRenderer } from '../map/renderer/MapRenderer'
import { AmbientScene } from './AmbientScene'
import './AmbientCanvas.scss'

const ATLAS_URL = '/atlas/atlas.json'

// The live backdrop of the landing and authentication pages (design §15.3): decoration only, so it is hidden from assistive
// technology. It plays while the tab is visible, and under reduced motion it is one still picture.
export default function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isReducedMotion = useSystemReducedMotion()

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement
    const animations: AnimationSystem = new AnimationSystem({
      now: () => performance.now(),
      isReducedMotion: () => isReducedMotion,
      locate: () => null,
      zoom: () => renderer.getCamera().zoom
    })
    const renderer: MapRenderer = new MapRenderer(canvas, { animations })
    const scene = new AmbientScene(renderer, animations, {
      setInterval: (callback, ms) => window.setInterval(callback, ms),
      clearInterval: (handle) => window.clearInterval(handle)
    })
    let isDisposed = false

    const play = () => (isReducedMotion ? scene.showStill() : document.hidden ? scene.pause() : scene.start())
    const resize = () => scene.fit(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio)

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()
    play()
    document.addEventListener('visibilitychange', play)
    void loadAtlas(ATLAS_URL).then((atlas) => {
      if (!isDisposed) {
        renderer.setAtlas(atlas)
      }
    })

    return () => {
      isDisposed = true
      scene.pause()
      document.removeEventListener('visibilitychange', play)
      resizeObserver.disconnect()
      renderer.dispose()
    }
  }, [isReducedMotion])

  return <canvas ref={canvasRef} className="ambient-canvas" aria-hidden="true" data-testid="ambient-scene" />
}
