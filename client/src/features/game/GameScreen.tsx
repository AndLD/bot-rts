'use client'

import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import GameMap from '../map/GameMap'
import FactoryPanel from '../factory/FactoryPanel'
import StoragePanel from '../storage/StoragePanel'
import Terminal from '../terminal/Terminal'
import WindowManager from '../windows/WindowManager'
import { GameWindow, openWindow, WindowKind } from '../windows/windows.slice'
import { useAppDispatch } from '../../shared/store/hooks'

// The windows a player can open from the toolbar, for the base; more kinds are added here as their panels are built
const LAUNCHABLE: WindowKind[] = ['terminal', 'storage', 'factory']

// The game screen: the map with the player's windows over it
export default function GameScreen({ baseId }: { baseId: string }) {
  const t = useTranslations('windows')
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(openWindow({ id: 'terminal', kind: 'terminal' }))
  }, [dispatch])

  function renderWindow(win: GameWindow) {
    switch (win.kind) {
      case 'terminal':
        return { title: t('kinds.terminal'), content: <Terminal /> }
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
            onClick={() => dispatch(openWindow({ id: kind, kind, params: { botId: baseId } }))}
          >
            {t(`kinds.${kind}`)}
          </Button>
        ))}
      </div>
      <WindowManager renderWindow={renderWindow} />
    </div>
  )
}
