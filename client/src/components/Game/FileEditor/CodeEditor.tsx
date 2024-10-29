import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import '../../../styles/CodeEditor.scss'
import prettier from 'prettier-standalone'

export default function CodeEditor() {
  const [code, setCode] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        formatCode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [code])

  async function formatCode() {
    try {
      const formattedCode = await prettier.format(code, {
        parser: 'babel',
        semi: false,
        singleQuote: true,
        tabWidth: 4
      })
      setCode(formattedCode)

      return formattedCode
    } catch (error) {
      console.error('Failed to format code:', error)
    }
  }

  const height = 400

  return (
    <div className="code-editor" style={{ height }}>
      <CodeMirror
        autoFocus
        extensions={[javascript({})]}
        value={code}
        theme="dark"
        height={`${height}px`}
        style={{ fontSize: 20 }}
        onChange={(value) => setCode(value)}
      />
    </div>
  )
}
