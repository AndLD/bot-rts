import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'

export default function CodeEditor() {
    const [code, setCode] = useState('')

    return (
        <CodeMirror
            extensions={[javascript({})]}
            value={code}
            theme="dark"
            height="100vh"
            style={{ fontSize: 20 }}
            onChange={(value) => setCode(value)}
        />
    )
}
