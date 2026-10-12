import { EXECUTION_SHORT_ID_LENGTH, IExecution, IScriptLog } from '@lib/utils/interfaces/executions'
import { GameEvent } from '@lib/utils/interfaces/events'
import { ITerminalCommandResponse, ITerminalCwd } from '@lib/utils/interfaces/terminal'
import { ErrorCode } from '@lib/utils/error-codes'
import { ResultCode } from '@lib/utils/result'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { useLogout } from '../auth/hooks'
import { useErrorMessage } from '../../shared/errors'
import { useSocket } from '../../shared/socket/socket-context'
import { escapeHtml, getPrefix, interpret, joinLines } from './interpreter'

const TOP: ITerminalCwd = { drive: null, directory: null }

// The file an `edit` command asked to open
export interface EditorState {
  path: string
  content: string
}

export interface TerminalConnection {
  botId: string
  sessionId: string
}

export interface TerminalOptions {
  // The terminal of a bot that `connect` reached: the stored session that was opened for it. Without it the terminal is the
  // one of the player's base.
  connection?: TerminalConnection
  // `connect` opened a session on another bot: it is a terminal window of its own (design §15)
  onConnected?: (connection: TerminalConnection) => void
  // `exit` was typed in a connected terminal: its window goes away
  onExit?: () => void
}

// The state of the terminal and the effects of the commands; the interpreter decides, this hook performs
export function useTerminal({ connection, onConnected, onExit }: TerminalOptions) {
  const t = useTranslations('terminal')
  const errorMessage = useErrorMessage()
  const socket = useSocket()
  const logout = useLogout()

  const [currentBotId, setCurrentBotId] = useState<string | null>(connection?.botId ?? null)
  const [sessionId, setSessionId] = useState<string | null>(connection?.sessionId ?? null)
  const [isLoading, setIsLoading] = useState(!connection)
  const [lines, setLines] = useState<string[]>([])
  const [isShellMode, setIsShellMode] = useState(false)
  const [cwd, setCwd] = useState<ITerminalCwd>(TOP)
  const [editor, setEditor] = useState<EditorState | null>(null)
  // Whether the radio link between the bot and the base holds; a command cannot reach a bot that is out of reach (design §11.2.1)
  const [isLinkUp, setIsLinkUp] = useState(true)

  const prefix = getPrefix({ isShellMode, cwd })

  // Every connection to the bot's terminal is a stored session on the server
  useEffect(() => {
    if (!socket?.active || connection) {
      return
    }

    socket.emit('get-user-bases', (bases) => {
      setIsLoading(false)

      if (bases?.length) {
        // The terminal is ready, and the prompt shown, only once the server has stored the session
        socket.emit('open-terminal', bases[0]._id, (session) => {
          if (session) {
            setSessionId(session._id)
            setCurrentBotId(bases[0]._id)
          }
        })
      }
    })
  }, [socket, connection])

  const print = useCallback(
    (echo: string[], ...output: string[]) => setLines((previous) => [...previous, ...echo, ...output]),
    []
  )

  // What the player's scripts write on this bot reaches the terminal as it is written, and so does the end of a script
  useEffect(() => {
    if (!socket || !currentBotId) {
      return
    }
    const onLog = ({ botId, executionId, text }: IScriptLog) => {
      if (botId === currentBotId) {
        setLines((previous) => [
          ...previous,
          escapeHtml(`[${executionId.slice(0, EXECUTION_SHORT_ID_LENGTH)}] ${text}`)
        ])
      }
    }
    const onExecution = ({ botId, id, state }: IExecution) => {
      if (botId === currentBotId && (state === 'finished' || state === 'killed')) {
        const line = t('scriptEnded', { id: id.slice(0, EXECUTION_SHORT_ID_LENGTH), state })
        setLines((previous) => [...previous, escapeHtml(line)])
      }
    }
    socket.on('script-log', onLog)
    socket.on('execution', onExecution)
    return () => {
      socket.off('script-log', onLog)
      socket.off('execution', onExecution)
    }
  }, [socket, currentBotId, t])

  // The link of the bot to its base: when it drops, nothing can be sent until it is back, and when it is back the player is
  // told what happened while the bot was out of reach (design §11.2.1)
  useEffect(() => {
    if (!socket || !currentBotId) {
      return
    }
    const onGameEvent = (event: GameEvent) => {
      if (event.parties[0].botId !== currentBotId) {
        return
      }
      if (event.type === 'LinkLost') {
        setIsLinkUp(false)
        setLines((previous) => [...previous, escapeHtml(t('connectionInterrupted'))])
      } else if (event.type === 'LinkRestored') {
        const { scans, events } = event.missed
        setIsLinkUp(true)
        setLines((previous) => [
          ...previous,
          escapeHtml(t('connectionRestored')),
          ...(scans || events ? [escapeHtml(t('missedSummary', { scans, events }))] : [])
        ])
      }
    }
    socket.on('game-event', onGameEvent)
    return () => void socket.off('game-event', onGameEvent)
  }, [socket, currentBotId, t])

  // A terminal that was reached with `connect` ends its session when its window goes away
  useEffect(() => {
    if (!socket || !connection) {
      return
    }
    return () => void socket.emit('close-terminal', connection.sessionId, () => undefined)
  }, [socket, connection])

  // The error as a line: translated by its code when we have a text for it, otherwise the server's own message. A usage
  // error and a script that cannot be loaded are the message itself, which says how the command is used or what is wrong.
  const failure = useCallback(
    (message?: string, code?: string) =>
      escapeHtml(
        t('error', {
          message: errorMessage({
            code: code === ErrorCode.COMMAND_USAGE || code === ErrorCode.SCRIPT_LOAD_FAILED ? undefined : code,
            message
          })
        })
      ),
    [t, errorMessage]
  )

  const show = useCallback(
    ({ result, cwd: place }: ITerminalCommandResponse, echo: string[]) => {
      setCwd(place)

      switch (result.type) {
        case 'output':
          return print(echo, ...result.lines.map(escapeHtml))
        case 'help':
          return print(
            echo,
            joinLines(
              result.commands.map(({ name, usage }) => `${usage} - ${t(`commands.${name}` as 'commands.help')}`)
            )
          )
        case 'clear':
          return setLines([])
        case 'exit':
          if (onExit) {
            onExit()
          } else {
            void logout()
          }
          return
        case 'connected':
          onConnected?.({ botId: result.botId, sessionId: result.sessionId })
          return print(echo, escapeHtml(t('connectedTo', { botId: result.botId })))
        case 'edit':
          setEditor({ path: result.path, content: result.content })
          return print(echo)
        case 'error':
          if (result.code === ResultCode.NO_SIGNAL) {
            setIsLinkUp(false)
            return print(echo, escapeHtml(t('connectionInterrupted')))
          }
          return print(echo, failure(result.message, result.code))
      }
    },
    [print, failure, logout, t, onConnected, onExit]
  )

  // Runs one line typed by the player; the promise-free API keeps the UI a plain controlled input
  const run = useCallback(
    (input: string) => {
      const echo = [escapeHtml(`${prefix} ${input}`)]
      const action = interpret(input, { isShellMode })

      switch (action.type) {
        case 'none':
          return print(echo)
        case 'clear':
          return setLines([])
        case 'enter-shell':
          setIsShellMode(true)
          return setLines([])
        case 'exit-shell':
          setIsShellMode(false)
          return setLines([])
        case 'send':
          if (!socket || !sessionId) {
            return print(echo, escapeHtml(t('notConnected')))
          }
          if (!isLinkUp) {
            // Only the way out is left to a bot that cannot be reached
            if (action.line === 'exit' && onExit) {
              return onExit()
            }
            return print(echo, escapeHtml(t('connectionInterrupted')))
          }
          return socket.emit('terminal-command', sessionId, action.line, (response, error) =>
            response ? show(response, echo) : print(echo, failure(error?.msg))
          )
      }
    },
    [socket, sessionId, isShellMode, isLinkUp, prefix, print, show, failure, t, onExit]
  )

  const saveEditor = useCallback(
    (content: string) => {
      if (!socket || !sessionId || !editor) {
        return
      }

      socket.emit('save-terminal-file', sessionId, editor.path, content, (file, error) => {
        if (file) {
          setEditor(null)
          print([], escapeHtml(t('saved', { path: file.path })))
        } else {
          print([], failure(error?.msg))
        }
      })
    },
    [socket, sessionId, editor, print, failure, t]
  )

  const closeEditor = useCallback(() => setEditor(null), [])

  return { currentBotId, isLoading, isShellMode, isLinkUp, lines, prefix, run, editor, saveEditor, closeEditor }
}
