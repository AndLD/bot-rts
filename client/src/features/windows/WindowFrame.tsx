'use client'

import { CloseOutlined } from '@ant-design/icons'
import { PointerEvent, ReactNode, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Rect } from './windows.slice'
import './WindowFrame.scss'

interface Props extends Rect {
  title: string
  z: number
  viewport: { width: number; height: number }
  onFocus(): void
  onClose(): void
  onPlace(change: Partial<Rect>): void
  children: ReactNode
}

// Keeps at least this much of the title bar on screen, so a window can always be grabbed again
const GRAB = 60

// One draggable, resizable window with a title bar
export default function WindowFrame({
  title,
  x,
  y,
  width,
  height,
  z,
  viewport,
  onFocus,
  onClose,
  onPlace,
  children
}: Props) {
  const t = useTranslations('windows')
  const gesture = useRef<{ mode: 'move' | 'resize'; pointerX: number; pointerY: number; rect: Rect } | null>(null)

  function begin(mode: 'move' | 'resize') {
    return (event: PointerEvent<HTMLElement>) => {
      event.stopPropagation()
      onFocus()
      gesture.current = { mode, pointerX: event.clientX, pointerY: event.clientY, rect: { x, y, width, height } }
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
  }

  function track(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current) {
      return
    }
    const dx = event.clientX - current.pointerX
    const dy = event.clientY - current.pointerY

    if (current.mode === 'move') {
      onPlace({
        x: Math.min(Math.max(current.rect.x + dx, GRAB - current.rect.width), viewport.width - GRAB),
        y: Math.min(Math.max(current.rect.y + dy, 0), viewport.height - GRAB)
      })
    } else {
      onPlace({ width: current.rect.width + dx, height: current.rect.height + dy })
    }
  }

  const end = () => {
    gesture.current = null
  }

  return (
    <section className="game-window" style={{ left: x, top: y, width, height, zIndex: z }} onPointerDown={onFocus}>
      <header
        className="game-window-title"
        onPointerDown={begin('move')}
        onPointerMove={track}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span>{title}</span>
        <button
          type="button"
          className="game-window-close"
          aria-label={t('close')}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <CloseOutlined />
        </button>
      </header>
      <div className="game-window-body">{children}</div>
      <div
        className="game-window-resize"
        data-testid="resize-handle"
        onPointerDown={begin('resize')}
        onPointerMove={track}
        onPointerUp={end}
        onPointerCancel={end}
      />
    </section>
  )
}
