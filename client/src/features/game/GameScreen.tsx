'use client'

import { Badge, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { showHelp } from '../../docs/help.slice'
import HelpPanel from '../help/HelpPanel'
import AwaySummary from '../notifications/AwaySummary'
import NotificationCenter from '../notifications/NotificationCenter'
import NotificationToasts from '../notifications/NotificationToasts'
import AchievementsPanel from '../achievements/AchievementsPanel'
import AchievementToasts from '../achievements/AchievementToasts'
import GameMap from '../map/GameMap'
import ControlPanel from '../control/ControlPanel'
import FactoryPanel from '../factory/FactoryPanel'
import SettingsPanel from '../settings/SettingsPanel'
import TutorialOverlay from '../tutorial/TutorialOverlay'
import StoragePanel from '../storage/StoragePanel'
import Terminal from '../terminal/Terminal'
import { TerminalConnection } from '../terminal/useTerminal'
import WindowManager from '../windows/WindowManager'
import { closeWindow, GameWindow, openWindow, WindowKind } from '../windows/windows.slice'
import { useNotificationsSummaryQuery, useTutorialGetQuery } from '../../shared/api'
import { useAppDispatch } from '../../shared/store/hooks'
import { TutorialStep } from '@lib/utils/interfaces/tutorial'

// The windows a player can open from the toolbar, for the base; more kinds are added here as their panels are built
// The toolbar button the tutorial points at for each step
const TUTORIAL_TARGET: Record<TutorialStep, WindowKind> = {
  openTerminal: 'terminal',
  listModules: 'terminal',
  scan: 'control',
  writeScript: 'terminal',
  runScript: 'terminal',
  craft: 'factory',
  assemble: 'factory'
}

// The windows that are about one bot: a bot has one of each, however it was opened (the toolbar, the map, another window)
const BOT_WINDOWS: WindowKind[] = ['control', 'storage']

// A bot's id as the player sees it in a title
const SHORT_ID = 8

const LAUNCHABLE: WindowKind[] = [
  'terminal',
  'control',
  'storage',
  'factory',
  'achievements',
  'notifications',
  'help',
  'settings'
]

// The game screen: the map with the player's windows over it
export default function GameScreen({ baseId }: { baseId: string }) {
  const t = useTranslations('windows')
  const dispatch = useAppDispatch()
  const { data: tutorial } = useTutorialGetQuery()
  const { data: summary } = useNotificationsSummaryQuery()
  const highlighted = tutorial?.current ? TUTORIAL_TARGET[tutorial.current] : null

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
          onHelp={openHelp}
          onExit={() => dispatch(closeWindow(win.id))}
        />
      )
    }
  }

  function openConnection({ botId, sessionId }: TerminalConnection) {
    dispatch(openWindow({ id: `terminal:${botId}`, kind: 'terminal', params: { botId, sessionId } }))
  }

  function openBotWindow(kind: WindowKind, botId: string) {
    dispatch(openWindow({ id: `${kind}:${botId}`, kind, params: { botId } }))
  }

  // The control panel of one of the player's bots
  function openControl(botId: string) {
    openBotWindow('control', botId)
  }

  // A page of the documentation, in the Help window
  function openHelp(slug: string) {
    dispatch(showHelp(slug))
    dispatch(openWindow({ id: 'help', kind: 'help', params: {} }))
  }

  // What a bot carries
  function openStorage(botId: string) {
    openBotWindow('storage', botId)
  }

  function renderWindow(win: GameWindow) {
    switch (win.kind) {
      case 'terminal':
        return win.params.botId
          ? connectedTerminal(win)
          : { title: t('kinds.terminal'), content: <Terminal onConnected={openConnection} onHelp={openHelp} /> }
      case 'control':
        return {
          title: t('kinds.botControl', { botId: win.params.botId.slice(0, SHORT_ID) }),
          content: <ControlPanel botId={win.params.botId} onOpenStorage={openStorage} />
        }
      case 'settings':
        return { title: t('kinds.settings'), content: <SettingsPanel /> }
      case 'help':
        return { title: t('kinds.help'), content: <HelpPanel /> }
      case 'notifications':
        return { title: t('kinds.notifications'), content: <NotificationCenter /> }
      case 'achievements':
        return { title: t('kinds.achievements'), content: <AchievementsPanel /> }
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
      <GameMap baseId={baseId} onOpenBot={openControl} />
      <div className="game-toolbar" role="toolbar">
        {LAUNCHABLE.map((kind) => {
          const button = (
            <Button
              key={kind}
              size="small"
              className={kind === highlighted ? 'tutorial-highlight' : undefined}
              onClick={() =>
                BOT_WINDOWS.includes(kind)
                  ? openBotWindow(kind, baseId)
                  : dispatch(openWindow({ id: kind, kind, params: kind === 'terminal' ? {} : { botId: baseId } }))
              }
            >
              {t(`kinds.${kind}`)}
            </Button>
          )

          return kind === 'notifications' ? (
            <Badge key={kind} count={summary?.unread ?? 0} size="small" overflowCount={99}>
              {button}
            </Badge>
          ) : (
            button
          )
        })}
      </div>
      <WindowManager renderWindow={renderWindow} />
      <TutorialOverlay />
      <AchievementToasts />
      <NotificationToasts />
      <AwaySummary />
    </div>
  )
}
