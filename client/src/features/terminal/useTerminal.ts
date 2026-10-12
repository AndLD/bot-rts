import { EXECUTION_SHORT_ID_LENGTH, IExecution, IScriptLog } from '@lib/utils/interfaces/executions'
import { ITerminalCommandResponse, ITerminalCwd } from '@lib/utils/interfaces/terminal'
import { ErrorCode } from '@lib/utils/error-codes'
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

// The state of the terminal and the effects of the commands; the interpreter decides, this hook performs
export function useTerminal() {
  const t = useTranslations('terminal')
  const errorMessage = useErrorMessage()
  const socket = useSocket()
  const logout = useLogout()

  const [currentBotId, setCurrentBotId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lines, setLines] = useState<string[]>([])
  const [isShellMode, setIsShellMode] = useState(false)
  const [cwd, setCwd] = useState<ITerminalCwd>(TOP)
  const [editor, setEditor] = useState<EditorState | null>(null)
  // The terminals `connect` was typed in, innermost last; `exit` goes back to the one before (design §11.2)
  const [outer, setOuter] = useState<Array<{ sessionId: string; botId: string }>>([])

  const prefix = getPrefix({ isShellMode, cwd })

  // Every connection to the bot's terminal is a stored session on the server
  useEffect(() => {
    if (!socket?.active) {
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
  }, [socket])

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
        case 'exit': {
          const previous = outer[outer.length - 1]
          if (!previous || !sessionId) {
            void logout()
            return
          }
          socket?.emit('close-terminal', sessionId, () => undefined)
          setOuter(outer.slice(0, -1))
          setSessionId(previous.sessionId)
          setCurrentBotId(previous.botId)
          setCwd(TOP)
          return print(echo, escapeHtml(t('backTo', { botId: previous.botId })))
        }
        case 'connected':
          setOuter([...outer, { sessionId: sessionId as string, botId: currentBotId as string }])
          setSessionId(result.sessionId)
          setCurrentBotId(result.botId)
          setCwd(TOP)
          return print(echo, escapeHtml(t('connectedTo', { botId: result.botId })))
        case 'edit':
          setEditor({ path: result.path, content: result.content })
          return print(echo)
        case 'error':
          return print(echo, failure(result.message, result.code))
      }
    },
    [print, failure, logout, t, outer, sessionId, currentBotId, socket]
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
          return socket.emit('terminal-command', sessionId, action.line, (response, error) =>
            response ? show(response, echo) : print(echo, failure(error?.msg))
          )
      }
    },
    [socket, sessionId, isShellMode, prefix, print, show, failure, t]
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

  return { currentBotId, isLoading, isShellMode, lines, prefix, run, editor, saveEditor, closeEditor }
}
