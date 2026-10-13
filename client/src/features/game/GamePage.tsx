'use client'

import { skipToken } from '@reduxjs/toolkit/query'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { SocketProvider } from '../../shared/socket/SocketProvider'
import { useToken } from '../../shared/store/hooks'
import GameScreen from './GameScreen'
import DeployBase from './DeployBase'
import { useBotsListQuery } from '../../shared/api'

export default function GamePage() {
  const t = useTranslations('game')
  const token = useToken()
  const { data: bases, isError } = useBotsListQuery(token ? { type: 'base' } : skipToken)

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        overflow: 'auto',
        position: 'relative',
        background: 'black',
        color: '#fff'
      }}
    >
      <Link href="/account" style={{ position: 'absolute', top: 12, right: 16, color: '#999', zIndex: 1 }}>
        {t('account')}
      </Link>

      {isError ? (
        <div style={{ padding: '56px 16px 16px' }}>{t('loadFailed')}</div>
      ) : !bases ? (
        <div style={{ padding: '56px 16px 16px' }}>{t('loading')}</div>
      ) : bases.length ? (
        <SocketProvider>
          <GameScreen baseId={bases[0]._id} />
        </SocketProvider>
      ) : (
        <DeployBase />
      )}
    </div>
  )
}
