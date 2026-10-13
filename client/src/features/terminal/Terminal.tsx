'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import HelpLink from '../../docs/HelpLink'
import './Terminal.scss'
import { TerminalOptions, useTerminal } from './useTerminal'
import { useStickyScroll } from './useStickyScroll'

const FONT_SIZE = 18

export default function Terminal(options: TerminalOptions) {
  const t = useTranslations('terminal')
  const { currentBotId, isLoading, isShellMode, isLinkUp, lines, prefix, run, editor, saveEditor, closeEditor } =
    useTerminal(options)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // New output scrolls the terminal down only for a reader who was at the bottom; their own command always does
  const { ref: scrollRef, onScroll, follow } = useStickyScroll<HTMLDivElement>(lines)

  const heading = !currentBotId
    ? isLoading
      ? t('loading')
      : t('failedToConnect')
    : isShellMode
      ? t('shellHeader', { botId: currentBotId })
      : t('welcome')

  function focusInput() {
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function submit() {
    follow()
    run(input)
    setInput('')
    focusInput()
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="terminal-scroll"
      style={{
        background: 'black',
        fontSize: FONT_SIZE,
        boxSizing: 'border-box',
        overflowY: 'auto',
        height: '100%',
        color: '#fff',
        padding: 10,
        cursor: 'default'
      }}
      onClick={focusInput}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: 10 }}>{heading}</div>
        {!isLinkUp && (
          <div role="alert" style={{ color: '#f87171', marginBottom: 10 }}>
            {t('connectionInterrupted')}
          </div>
        )}

        {/* Lines are escaped by the interpreter; only the line break tag is markup */}
        {currentBotId && lines.map((line, i) => <div key={i} dangerouslySetInnerHTML={{ __html: line }}></div>)}
      </div>
      {currentBotId && !editor && (
        <div style={{ display: 'flex', gap: 15 }}>
          {prefix}
          <input
            className="terminal-input"
            style={{ fontSize: FONT_SIZE }}
            ref={inputRef}
            spellCheck={false}
            autoFocus
            disabled={!isLinkUp}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // The editor a command opens takes the focus; the key must not type a line break into it
                e.preventDefault()
                submit()
              }
            }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      )}
      {editor && <FileEditor key={editor.path} {...editor} onSave={saveEditor} onCancel={closeEditor} />}
    </div>
  )
}

// A plain editor for the file of an `edit` command; the code editor with syntax highlighting arrives with the GUI
function FileEditor({
  path,
  content,
  onSave,
  onCancel
}: {
  path: string
  content: string
  onSave: (content: string) => void
  onCancel: () => void
}) {
  const t = useTranslations('terminal')
  const [text, setText] = useState(content)

  return (
    <div className="terminal-editor" onClick={(e) => e.stopPropagation()}>
      <div>{t('editing', { path })}</div>
      <textarea
        aria-label={t('editorLabel')}
        className="terminal-editor-text"
        spellCheck={false}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 15 }}>
        <button onClick={() => onSave(text)}>{t('save')}</button>
        <button onClick={onCancel}>{t('cancel')}</button>
        <HelpLink slug="examples" />
        <HelpLink slug="examples" />
      </div>
    </div>
  )
}
