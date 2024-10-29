import { MouseEventHandler, useEffect, useRef, useState } from 'react'

export function useDnD() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const fileEditorRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  const onMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const onMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x
      const newY = e.clientY - dragStart.y

      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Boundary checks to allow cursor to go to the edges
      const boundedX = Math.min(Math.max(newX, -dragStart.x), viewportWidth - dragStart.x)
      const boundedY = Math.min(Math.max(newY, -dragStart.y), viewportHeight - dragStart.y)

      setPosition({ x: boundedX, y: boundedY })
    }
  }

  const onMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    } else {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (fileEditorRef.current) {
      setIsReady(true)
      setPosition({
        x: window.innerWidth / 2 - fileEditorRef.current.offsetWidth / 2,
        y: window.innerHeight / 2 - fileEditorRef.current.offsetHeight / 2
      })
    }
  }, [])

  return { fileEditorRef, onMouseDown, position, isDragging, isReady }
}
