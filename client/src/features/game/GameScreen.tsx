'use client'

import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import GameMap from '../map/GameMap'
import FactoryPanel from '../factory/FactoryPanel'
import SettingsPanel from '../settings/SettingsPanel'
import StoragePanel from '../storage/StoragePanel'
import Terminal from '../terminal/Terminal'
import { TerminalConnection } from '../terminal/useTerminal'
import WindowManager from '../windows/WindowManager'
import { closeWindow, GameWindow, openWindow, WindowKind } from '../windows/windows.slice'
import { useAppDispatch } from '../../shared/store/hooks'

// The windows a player can open from the toolbar, for the base; more kinds are added here as their panels are built
// A bot's id as the player sees it in a title
const SHORT_ID = 8

const LAUNCHABLE: WindowKind[] = ['terminal', 'storage', 'factory', 'settings']

// The game screen: the map with the player's windows over it
export default function GameScreen({ baseId }: { baseId: string }) {
  const t = useTranslations('windows')
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(openWindow({ id: 'terminal', kind: 'terminal' }))
  }, [dispatch])

  // The terminal that `connect` opened on another bot, with its own stored session
  function connectedTerminal(win: GameWindow) {
    const { botId, sessionId } = win.params

    return {
      title: t('kinds.botTerminal', { botId: botId.slice(0, SHORT_ID) }),
      content: (
        <Terminal
          connection={{ botId, sessionId }}
          onConnected={openConnection}
          onExit={() => dispatch(closeWindow(win.id))}
        />
      )
    }
  }

  function openConnection({ botId, sessionId }: TerminalConnection) {
    dispatch(openWindow({ id: `terminal:${botId}`, kind: 'terminal', params: { botId, sessionId } }))
  }

  function renderWindow(win: GameWindow) {
    switch (win.kind) {
      case 'terminal':
        return win.params.botId
          ? connectedTerminal(win)
          : { title: t('kinds.terminal'), content: <Terminal onConnected={openConnection} /> }
      case 'settings':
        return { title: t('kinds.settings'), content: <SettingsPanel /> }
      case 'factory':
        return { title: t('kinds.factory'), content: <FactoryPanel baseId={win.params.botId} /> }
      case 'storage':
        return { title: t('kinds.storage'), content: <StoragePanel botId={win.params.botId} /> }
      default:
        return { title: t(`kinds.${win.kind}`), content: null }
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <GameMap baseId={baseId} />
      <div className="game-toolbar" role="toolbar">
        {LAUNCHABLE.map((kind) => (
          <Button
            key={kind}
            size="small"
            onClick={() =>
              dispatch(openWindow({ id: kind, kind, params: kind === 'terminal' ? {} : { botId: baseId } }))
            }
          >
            {t(`kinds.${kind}`)}
          </Button>
        ))}
      </div>
      <WindowManager renderWindow={renderWindow} />
    </div>
  )
}
