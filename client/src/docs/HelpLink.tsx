'use client'

import { QuestionCircleOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useAppDispatch } from '../shared/store/hooks'
import { openWindow } from '../features/windows/windows.slice'
import { showHelp } from './help.slice'

// A "?" that opens the Help window of the game at a page of the documentation (design §15.5)
export default function HelpLink({ slug }: { slug: string }) {
  const t = useTranslations('docs.help')
  const dispatch = useAppDispatch()

  return (
    <Button
      type="text"
      size="small"
      icon={<QuestionCircleOutlined />}
      aria-label={t('what')}
      title={t('what')}
      onClick={() => {
        dispatch(showHelp(slug))
        dispatch(openWindow({ id: 'help', kind: 'help', params: {} }))
      }}
    />
  )
}
