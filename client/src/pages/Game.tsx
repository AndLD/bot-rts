import { useSocketServer } from '../hooks/auth'
import FileEditor from '../components/Game/FileEditor/FileEditor'
import Terminal from '../components/Game/Terminal/Terminal'

export default function Game() {
    useSocketServer()

    return (
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
            {/* <FileEditor /> */}
        </div>
    )
}
