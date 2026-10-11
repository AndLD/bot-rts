import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { useLogout } from '../auth/hooks'
import { useSocket } from '../../shared/socket/socket-context'
import { escapeHtml, formatBots, formatModules, getPrefix, interpret, TerminalAction } from './interpreter'

// The state of the terminal and the effects of the commands; the interpreter decides, this hook performs
export function useTerminal() {
  const t = useTranslations('terminal')
  const socket = useSocket()
  const logout = useLogout()

  const [currentBotId, setCurrentBotId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lines, setLines] = useState<string[]>([])
  const [isShellMode, setIsShellMode] = useState(false)
  const [driveNames] = useState<string[]>([])
  const [selectedDriveName, setSelectedDriveName] = useState<string | null>(null)

  const prefix = getPrefix({ isShellMode, selectedDriveName })

  useEffect(() => {
    if (!socket?.active) {
      return
    }

    socket.emit('get-user-bases', (bases) => {
      setIsLoading(false)

      if (bases?.length) {
        setCurrentBotId(bases[0]._id)
      }
    })
  }, [socket])

  const perform = useCallback(
    (action: TerminalAction, echo: string[]) => {
      const print = (...output: string[]) => setLines((previous) => [...previous, ...echo, ...output])

      switch (action.type) {
        case 'none':
          return print()
        case 'clear':
          return setLines([])
        case 'reply':
          return print('html' in action.reply ? action.reply.html : t(action.reply.message))
        case 'logout':
          return logout()
        case 'enter-shell':
          setIsShellMode(true)
          return setLines([])
        case 'exit-shell':
          setIsShellMode(false)
          return setLines([])
        case 'select-drive':
          setSelectedDriveName(action.driveName)
          return print()
        case 'list-bots':
          return socket?.emit('get-user-bots', (bots) => print(formatBots(bots ?? [], currentBotId)))
        case 'list-modules':
          return currentBotId
            ? socket?.emit('get-bot-modules', currentBotId, (modules, error) =>
                print(
                  error
                    ? escapeHtml(t('error', { message: error.msg }))
                    : modules
                      ? formatModules(modules)
                      : t('nothing')
                )
              )
            : print(t('nothing'))
      }
    },
    [socket, logout, currentBotId, t]
  )

  // Runs one line typed by the player; the returned promise-free API keeps the UI a plain controlled input
  const run = useCallback(
    (input: string) => {
      perform(interpret(input, { isShellMode, driveNames, selectedDriveName }), [escapeHtml(`${prefix} ${input}`)])
    },
    [perform, isShellMode, driveNames, selectedDriveName, prefix]
  )

  return { currentBotId, isLoading, isShellMode, lines, prefix, run }
}
