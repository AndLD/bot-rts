'use client'

import { Tabs } from 'antd'
import { useTranslations } from 'next-intl'
import BalanceEditor from './BalanceEditor'
import EconomyOverview from './EconomyOverview'
import GameSwitches from './GameSwitches'

// Economy and balance (design §25.3): the state of the economy, the balance of the game with its versions, and the global switches
export default function EconomyPage() {
  const t = useTranslations('admin.economy')

  return (
    <Tabs
      items={[
        { key: 'overview', label: t('tabs.overview'), children: <EconomyOverview /> },
        { key: 'balance', label: t('tabs.balance'), children: <BalanceEditor /> },
        { key: 'switches', label: t('tabs.switches'), children: <GameSwitches /> }
      ]}
    />
  )
}
