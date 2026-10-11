'use client'

import { SocketProvider } from '../../shared/socket/SocketProvider'
import Terminal from '../terminal/Terminal'

export default function GamePage() {
  return (
    <SocketProvider>
      <div
        style={{
          height: '100vh',
          maxHeight: '100vh',
          width: '100vw',
          maxWidth: '100vw',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Terminal />
      </div>
    </SocketProvider>
  )
}
