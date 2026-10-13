'use client'

import { Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { useModuleName } from '../features/factory/useModuleName'
import HelpLink from './HelpLink'

// The name of a module, with a tooltip that leads to the module catalogue of the Help window (design §15.5)
export default function ModuleHelpName({ module }: { module: string }) {
  const t = useTranslations('docs.help')
  const moduleName = useModuleName()

  return (
    <Tooltip
      title={<HelpLink slug="modules" />}
      placement="top"
      overlayInnerStyle={{ padding: 2 }}
      aria-label={t('learnMore')}
    >
      <strong>{moduleName(module)}</strong>
    </Tooltip>
  )
}
