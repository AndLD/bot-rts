'use client'

import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import DocsBrowser from '../../docs/DocsBrowser'
import { DocsNavigation } from '../../docs/DocsContext'
import { useTutorialRestartMutation } from '../../shared/api'
import { API_URL } from '../../shared/config'
import { useAppSelector } from '../../shared/store/hooks'

// The documentation inside the game (design §15.5): the same pages and search as /docs, shown in a window, with links that stay in the
// window. The content is part of the client, so it works offline. It also brings the tutorial back.
export default function HelpPanel() {
  const t = useTranslations('docs.help')
  const requested = useAppSelector((state) => state.help)
  const [slug, setSlug] = useState(requested.slug)
  const [restartTutorial] = useTutorialRestartMutation()

  // Another part of the game asked for a page (a "?" next to something)
  useEffect(() => setSlug(requested.slug), [requested])

  const navigation: DocsNavigation = { hrefOf: (target) => `#${target}`, open: setSlug, apiUrl: API_URL }

  return (
    <div className="help-panel">
      <div className="help-tools">
        <Button size="small" onClick={() => restartTutorial()}>
          {t('reopenTutorial')}
        </Button>
      </div>
      <DocsBrowser slug={slug} navigation={navigation} />
    </div>
  )
}
