import { useEffect, useRef, useState } from 'react'
import { useAppSelector } from '../../../hooks/store'
import { IDriveModuleProps, IModuleProps } from '@lib/utils/interfaces/modules'
import '../../../styles/Terminal.scss'
import { useLogout } from '../../../hooks/store/auth.api'
import { IBot } from '@lib/utils/interfaces/bots'
import { ID } from '@lib/utils/types'
import beautify from 'json-beautify'

const defaultPrefix = '/>'
const shellModePrefix = '>>>'

export default function Terminal() {
  const [currentBotId, setCurrentBotId] = useState<ID | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [commands, setCommands] = useState<string[]>([])
  const [command, setCommand] = useState('')
  const [isWaitingForReply, setIsWaitingForReply] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [drives, setDrives] = useState<IDriveModuleProps[]>([])
  const [selectedDrive, setSelectedDrive] = useState<IDriveModuleProps | null>(null)
  const [prefix, setPrefix] = useState(defaultPrefix)
  const [isShellMode, setIsShellMode] = useState(false)
  const socket = useAppSelector((state) => state.appReducer.socket)

  const logout = useLogout()

  function getPrefixWithDrive(driveName?: string) {
    return `/${driveName || ''}>`
  }

  function updateCommands(commands: string[]) {
    setIsWaitingForReply(false)
    setCommand('')
    setCommands(commands)
    focusInput()
  }

  useEffect(() => {
    if (!isWaitingForReply) {
      return
    }

    const formattedCommand = prefix + ' ' + command

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

    // Common commands for both default and shell modes
    if (command === '') {
      updateCommands([...commands, formattedCommand])
    } else if (command === 'clear') {
      updateCommands([])
    } else if (isShellMode) {
      // Shell mode commands
      if (command === 'exit') {
        setIsShellMode(false)
      } else {
        // Execute as code line
      }
    } else {
      // Default mode commands
      if (command === 'ls' || command === 'dir') {
        if (selectedDrive) {
          // list files list
        } else {
          // show drives list
          reply(drives.map((drive) => drive.name).join('</br>'))
        }
      } else if (command === 'shell') {
        setIsShellMode(true)
      } else if (command === 'exit') {
        logout()
      } else if (command === 'list') {
        socket?.emit('get-user-bots', (bots: IBot[]) => {
          console.log(bots)

          const result = bots
            .map(
              (bot) =>
                `${bot._id === currentBotId ? '(current)' : '-'} id="${bot._id}" ${bot.label && `label="${bot.label}"`} type="${bot.type}"`
            )
            .join('</br>')

          updateCommands([...commands, formattedCommand, result])
        })
      } else if (command === 'modules') {
        socket?.emit('get-bot-modules', currentBotId, (modules: IModuleProps[], err: Error) => {
          let result = ''
          if (err) {
            result = `Error: ${err.message}`
          } else if (modules) {
            console.log(modules)

            result = modules
              .map((module) => `- id="${module._id}" type="${module.type}" name="${module.name}"`)
              .join('</br>')
          } else {
            result = 'null'
          }

          updateCommands([...commands, formattedCommand, result])
        })
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
    }
  }, [isWaitingForReply])

  useEffect(() => {
    if (isShellMode) {
      setPrefix(shellModePrefix)
    } else {
      setPrefix(defaultPrefix)
    }
    updateCommands([])
  }, [isShellMode])

  useEffect(() => {
    if (!socket?.active) {
      return
    }

    console.log('DEBUG 2')

    socket.emit('get-user-bases', (bases: IBot[]) => {
      console.log(bases)
      setIsLoading(false)

      if (bases.length) {
        setCurrentBotId(bases[0]._id)
      }
    })
  }, [socket])

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
        <div style={{ marginBottom: 10 }}>
          {currentBotId
            ? isShellMode
              ? `Bot shell v0.0.1, bot id = ${currentBotId}`
              : '# Welcome to BotOS Alpha 0.1.0 #'
            : isLoading
              ? 'Loading...'
              : 'Failed to connect'}
        </div>

        {currentBotId &&
          commands.map((command, i) => <div key={'command' + i} dangerouslySetInnerHTML={{ __html: command }}></div>)}
      </div>
      {currentBotId && (
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
      )}
    </div>
  )
}
