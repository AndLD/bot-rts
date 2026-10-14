'use client'

import { Button, List, Modal, Space } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import { useInspectorFilesQuery, useLazyInspectorFileQuery } from '../../../shared/api'
import { useErrorMessage } from '../../../shared/errors'
import { errorNotification } from '../../../shared/notifications'
import { useAdminMe } from '../admin-me-context'

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : undefined)

// The files of one drive. Listing is part of the inspection; opening a file needs its own permission and is audited.
export default function FileBrowser({ botId, driveId }: { botId: string; driveId: string }) {
  const t = useTranslations('admin.inspector.files')
  const getErrorMessage = useErrorMessage()
  const { role } = useAdminMe()
  const [directory, setDirectory] = useState<string | undefined>()
  const [opened, setOpened] = useState<{ path: string; content: string } | null>(null)
  const { data: entries } = useInspectorFilesQuery({ id: botId, driveId, dir: directory })
  const [readFile] = useLazyInspectorFileQuery()
  const canRead = hasPermission(role, 'inspector.files.read')

  async function open(path: string) {
    const result = await readFile({ id: botId, driveId, path })

    if (result.error) {
      const body = (result.error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))
      return
    }
    if (result.data) {
      setOpened({ path: result.data.path, content: result.data.content })
    }
  }

  return (
    <>
      {directory ? (
        <Button type="link" onClick={() => setDirectory(parentOf(directory))}>{`← ${directory}`}</Button>
      ) : null}
      <List
        size="small"
        dataSource={entries ?? []}
        renderItem={(entry) => (
          <List.Item>
            {entry.kind === 'directory' ? (
              <Button type="link" onClick={() => setDirectory(entry.path)}>{`📁 ${entry.path}`}</Button>
            ) : (
              <Space>
                <span>{entry.path}</span>
                <span>{t('bytes', { count: entry.size })}</span>
                {canRead ? (
                  <Button size="small" onClick={() => open(entry.path)}>
                    {t('open')}
                  </Button>
                ) : null}
              </Space>
            )}
          </List.Item>
        )}
      />
      <Modal open={opened !== null} title={opened?.path} footer={null} onCancel={() => setOpened(null)} width={720}>
        <pre style={{ maxHeight: 480, overflow: 'auto' }}>{opened?.content}</pre>
      </Modal>
    </>
  )
}
