import { useEffect, useRef, useState } from 'react'
import { useAppSelector } from '../../../hooks/store'
import { IDriveModuleProps } from '../../../utils/interfaces/modules'
import '../../../styles/Terminal.scss'

export default function Terminal() {
    const [commands, setCommands] = useState<string[]>([])
    const [command, setCommand] = useState('')
    const [isWaitingForReply, setIsWaitingForReply] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const [drives, setDrives] = useState<IDriveModuleProps[]>([])
    const [selectedDrive, setSelectedDrive] = useState<IDriveModuleProps | null>(null)
    const [prefix, setPrefix] = useState('/>')
    const socket = useAppSelector((state) => state.appReducer.socket)

    function getPrefixWithDrive(driveName?: string) {
        return `/${driveName || ''}>`
    }

    useEffect(() => {
        if (!isWaitingForReply) {
            return
        }

        const formattedCommand = prefix + ' ' + command

        function updateCommands(commands: string[]) {
            setIsWaitingForReply(false)
            setCommand('')
            setCommands(commands)
            focusInput()
        }

        function selectDrive(driveName: string) {
            const drive = drives.find((drive) => drive.name === driveName)

            if (drive) {
                setSelectedDrive(drive)
                setPrefix(getPrefixWithDrive(driveName))
            } else {
                reply('Unknown path')
            }
        }

        function reply(text: string) {
            updateCommands([...commands, formattedCommand, text])
        }

        async function replyAsync() {
            if (!socket?.connected) {
                return
            }

            const reply = 'Hello'

            updateCommands([...commands, formattedCommand, reply])
        }

        if (command === '') {
            updateCommands([...commands, formattedCommand])
        } else if (command === 'clear') {
            updateCommands([])
        } else if (command === 'ls' || command === 'dir') {
            if (selectedDrive) {
                // list files list
            } else {
                // show drives list
                reply(drives.map((drive) => drive.name).join('\n'))
            }
        } else {
            const words = command.split(' ')

            if (words.length === 2 && words[0] === 'cd') {
                if (words[1] === '..') {
                    setSelectedDrive(null)
                    updateCommands([...commands, formattedCommand])
                } else if (words[1].startsWith('../')) {
                    const driveName = words[1].split('../')[1]

                    selectDrive(driveName)
                } else {
                    selectDrive(words[1])
                }
            } else {
                reply('Unknown command')
            }
        }
    }, [isWaitingForReply])

    function focusInput() {
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const fontSize = 30

    return (
        <div
            style={{
                background: 'black',
                fontSize,
                minHeight: 400,
                height: '100%',
                color: '#fff',
                padding: 10,
                cursor: 'default'
            }}
            onClick={focusInput}
        >
            <div onClick={(e) => e.stopPropagation()}>
                <div style={{ marginBottom: 10 }}># Welcome to BotOS Alpha 0.1.0 #</div>

                {commands.map((command, i) => (
                    <div key={'command' + i}>{command}</div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 15 }}>
                {prefix}
                <input
                    className="terminal-input"
                    style={{ fontSize }}
                    ref={inputRef}
                    disabled={isWaitingForReply}
                    spellCheck={false}
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setIsWaitingForReply(true)
                        }
                    }}
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                />
            </div>
        </div>
    )
}
