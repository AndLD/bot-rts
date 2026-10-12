'use client'

import { Button, Progress } from 'antd'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useBotControlGetStorageQuery } from '../../shared/api'
import { useBotAction } from '../control/useBotAction'

// What the storage shows is refreshed this often, because scripts and other actions change it too
const REFRESH_MS = 3000

// What a bot carries: resources in its storage and the items in its hands, with take and drop (design §9, §15.1)
export default function StoragePanel({ botId }: { botId: string }) {
  const t = useTranslations('storage')
  const names = useTranslations('map')
  const { data, isError } = useBotControlGetStorageQuery({ botId }, { pollingInterval: REFRESH_MS })
  const act = useBotAction(botId)
  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setBusy] = useState(false)

  async function run(fn: 'take' | 'drop') {
    setBusy(true)
    const outcome = await act(fn)
    setMessage(outcome.ok ? null : (outcome.message as string))
    setBusy(false)
  }

  if (isError) {
    return <div className="storage-panel">{t('loadFailed')}</div>
  }
  if (!data) {
    return <div className="storage-panel">{t('loading')}</div>
  }

  return (
    <div className="storage-panel" style={{ padding: 10 }}>
      <div>{t('used', { used: data.used, capacity: data.capacity })}</div>
      <Progress
        percent={data.capacity ? Math.round((data.used / data.capacity) * 100) : 0}
        showInfo={false}
        size="small"
      />

      <h4>{t('resources')}</h4>
      {data.resources.length ? (
        <ul>
          {data.resources.map(({ resource, amount }) => (
            <li key={resource}>
              {names(`resources.${resource}`)}: {amount}
            </li>
          ))}
        </ul>
      ) : (
        <div>{t('noResources')}</div>
      )}

      <h4>{t('items')}</h4>
      <div>{t('load', { carried: data.carriedWeight, capacity: data.loadCapacity })}</div>
      {data.items.length ? (
        <ul>
          {data.items.map((item) => (
            <li key={item._id}>
              {names(`items.${item.type}`)} {item.name} ({item.weight} kg)
            </li>
          ))}
        </ul>
      ) : (
        <div>{t('noItems')}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button size="small" disabled={isBusy} onClick={() => run('take')}>
          {t('take')}
        </Button>
        <Button size="small" disabled={isBusy || !data.items.length} onClick={() => run('drop')}>
          {t('drop')}
        </Button>
      </div>
      {message && (
        <div role="alert" style={{ color: '#f87171', marginTop: 8 }}>
          {message}
        </div>
      )}
    </div>
  )
}
