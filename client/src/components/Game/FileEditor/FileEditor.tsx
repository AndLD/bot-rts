import CodeEditor from './CodeEditor'
import FileHeader from './FileHeader'
import { useDnD } from '../../../hooks/pages/Game'

export default function FileEditor() {
    const { fileEditorRef, onMouseDown, position, isDragging, isReady } = useDnD()

    return (
        <div
            ref={fileEditorRef}
            style={{
                width: 1000,
                visibility: isReady ? 'visible' : 'hidden',
                position: 'absolute',
                top: position.y,
                left: position.x,
                zIndex: isDragging ? 1 : 0,
                cursor: isDragging ? 'grabbing' : 'default',
                border: '3px solid #fff'
            }}
        >
            <FileHeader onMouseDown={onMouseDown} />
            <CodeEditor />
        </div>
    )
}
