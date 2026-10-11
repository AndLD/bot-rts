import { useRef, useState } from 'react'
import './Terminal.scss'
import { useTerminal } from './useTerminal'

const FONT_SIZE = 30

function getHeading({ currentBotId, isShellMode, isLoading }: ReturnType<typeof useTerminal>) {
  if (!currentBotId) {
    return isLoading ? 'Loading...' : 'Failed to connect'
  }

  return isShellMode ? `Bot shell v0.0.1, bot id = ${currentBotId}` : '# Welcome to BotOS Alpha 0.1.0 #'
}

export default function Terminal() {
  const terminal = useTerminal()
  const { currentBotId, lines, prefix, run } = terminal
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function submit() {
    run(input)
    setInput('')
    focusInput()
  }

  return (
    <div
      style={{
        background: 'black',
        fontSize: FONT_SIZE,
        minHeight: 400,
        height: '100%',
        color: '#fff',
        padding: 10,
        cursor: 'default'
      }}
      onClick={focusInput}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 10 }}>{getHeading(terminal)}</div>

        {/* Lines are escaped by the interpreter; only the line break tag is markup */}
        {currentBotId && lines.map((line, i) => <div key={i} dangerouslySetInnerHTML={{ __html: line }}></div>)}
      </div>
      {currentBotId && (
        <div style={{ display: 'flex', gap: 15 }}>
          {prefix}
          <input
            className="terminal-input"
            style={{ fontSize: FONT_SIZE }}
            ref={inputRef}
            spellCheck={false}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
