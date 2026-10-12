'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../shared/store/hooks'
import WindowFrame from './WindowFrame'
import { closeWindow, focusWindow, GameWindow, placeWindow } from './windows.slice'

interface Props {
  // What each window shows and is called, decided by the screen that owns the windows (new kinds need no change here)
  renderWindow(window: GameWindow): { title: string; content: ReactNode }
  children?: ReactNode
}

// Lays the open windows over the game screen and tracks the size of the screen they must stay inside
export default function WindowManager({ renderWindow, children }: Props) {
  const dispatch = useAppDispatch()
  const windows = useAppSelector((state) => state.windows.windows)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)

    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <>
      {children}
      {windows.map((win) => {
        const { title, content } = renderWindow(win)

        return (
          <WindowFrame
            key={win.id}
            title={title}
            x={win.x}
            y={win.y}
            width={win.width}
            height={win.height}
            z={win.z}
            viewport={viewport}
            onFocus={() => dispatch(focusWindow(win.id))}
            onClose={() => dispatch(closeWindow(win.id))}
            onPlace={(change) => dispatch(placeWindow({ id: win.id, ...change }))}
          >
            {content}
          </WindowFrame>
        )
      })}
    </>
  )
}
