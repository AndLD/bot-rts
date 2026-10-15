'use client'

import { Alert, Button, Card, Collapse, Input, Space, Spin, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { hasPermission } from '@lib/utils/admin'
import type { IBalancePreview } from '@lib/utils/admin-balance'
import {
  useBalancePreviewMutation,
  useBalanceRollbackMutation,
  useBalanceSaveMutation,
  useBalanceStateQuery,
  useLazyBalanceVersionQuery
} from '../../../shared/api'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from '../players/ActionModal'
import { useReportFailure } from '../use-report-failure'

type Document = Record<string, object>
type Pending = { type: 'save'; document: Document } | { type: 'rollback'; version: number }

// The balance of the game (design §25.3): a JSON document with only what differs from the defaults, checked and compared with what
// is active before it is saved as a new version. A rollback is a new version too. A version applies when the server next starts.
export default function BalanceEditor() {
  const t = useTranslations('admin.economy.balance')
  const format = useFormatter()
  const { role } = useAdminMe()
  const report = useReportFailure()
  const canWrite = hasPermission(role, 'balance.write')
  const { data, isError } = useBalanceStateQuery()
  const [loadVersion] = useLazyBalanceVersionQuery()
  const [previewDocument, previewState] = useBalancePreviewMutation()
  const [save, saveState] = useBalanceSaveMutation()
  const [rollback, rollbackState] = useBalanceRollbackMutation()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<IBalancePreview | null>(null)
  const [syntaxError, setSyntaxError] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  const documentJson = data?.documentJson
  const activeVersion = data?.activeVersion

  // What is active replaces the text of the editor whenever it changes (a first load, a save, a rollback)
  useEffect(() => {
    if (documentJson !== undefined) {
      setText(documentJson)
      setPreview(null)
    }
  }, [documentJson, activeVersion])

  if (isError) {
    return <Alert type="error" message={t('loadFailed')} />
  }
  if (!data) {
    return <Spin />
  }

  // The document of the editor, or null with the syntax error shown
  function parse(): Document | null {
    try {
      const document: unknown = JSON.parse(text)
      if (typeof document === 'object' && document !== null && !Array.isArray(document)) {
        setSyntaxError(false)
        return document as Document
      }
    } catch {
      // reported below, the same way as a document that is not an object
    }
    setSyntaxError(true)

    return null
  }

  async function validate() {
    const document = parse()
    if (document) {
      const result = await previewDocument({ balanceDocumentDto: { document } })
      if (!report(result)) {
        setPreview((result as { data: IBalancePreview }).data)
      }
    }
  }

  function askToSave() {
    const document = parse()
    if (document) {
      setPending({ type: 'save', document })
    }
  }

  async function show(version: number) {
    const result = await loadVersion({ version })
    if (!report(result)) {
      setText((result.data as { documentJson: string }).documentJson)
      setPreview(null)
      setSyntaxError(false)
    }
  }

  async function submit({ reason }: ActionValues) {
    const current = pending as Pending
    const result =
      current.type === 'save'
        ? await save({ saveBalanceDto: { document: current.document, reason } })
        : await rollback({ version: current.version, reasonDto: { reason } })

    if (!report(result)) {
      setPending(null)
    }
  }

  const date = (ms: number) => format.dateTime(new Date(ms), { dateStyle: 'short', timeStyle: 'short' })

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {data.problem ? <Alert type="error" message={t('problem', { problem: data.problem })} /> : null}
      <Space>
        <span>{t('active', { version: data.activeVersion ?? t('defaultsName') })}</span>
        {data.activeVersion !== data.runningVersion ? (
          <Tag color="warning">{t('afterRestart', { version: data.runningVersion ?? t('defaultsName') })}</Tag>
        ) : null}
      </Space>
      <Input.TextArea
        aria-label={t('document')}
        rows={14}
        value={text}
        readOnly={!canWrite}
        spellCheck={false}
        style={{ fontFamily: 'monospace' }}
        onChange={(event) => setText(event.target.value)}
      />
      {syntaxError ? <Alert type="error" message={t('notJson')} /> : null}
      {canWrite ? (
        <Space>
          <Button onClick={validate} loading={previewState.isLoading}>
            {t('validate')}
          </Button>
          <Button type="primary" onClick={askToSave}>
            {t('save')}
          </Button>
        </Space>
      ) : null}
      {preview?.problems.length ? (
        <Alert type="error" message={t('problems')} description={preview.problems.join('\n')} />
      ) : null}
      {preview && !preview.problems.length ? (
        <Card size="small" title={t('changes')}>
          <Table
            size="small"
            rowKey="path"
            pagination={false}
            locale={{ emptyText: t('noChanges') }}
            dataSource={preview.changes}
            columns={[
              { title: t('path'), dataIndex: 'path' },
              { title: t('from'), dataIndex: 'from', render: (value: string | null) => value ?? '–' },
              { title: t('to'), dataIndex: 'to', render: (value: string | null) => value ?? '–' }
            ]}
          />
        </Card>
      ) : null}
      <Card size="small" title={t('versions')}>
        <Table
          size="small"
          rowKey="version"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          dataSource={data.versions}
          columns={[
            {
              title: t('version'),
              dataIndex: 'version',
              render: (version: number, entry) => (
                <>
                  {version} {entry.isActive ? <Tag color="green">{t('activeTag')}</Tag> : null}
                </>
              )
            },
            { title: t('reason'), dataIndex: 'reason' },
            { title: t('createdAt'), dataIndex: 'createdAt', render: date },
            {
              title: '',
              render: (_, entry) => (
                <Space>
                  <Button size="small" onClick={() => show(entry.version)}>
                    {t('view')}
                  </Button>
                  {canWrite && !entry.isActive ? (
                    <Button
                      size="small"
                      danger
                      onClick={() => setPending({ type: 'rollback', version: entry.version })}
                    >
                      {t('rollback')}
                    </Button>
                  ) : null}
                </Space>
              )
            }
          ]}
        />
      </Card>
      <Collapse
        items={[
          {
            key: 'effective',
            label: t('effective'),
            children: (
              <Table
                size="small"
                rowKey="path"
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                dataSource={data.effective}
                columns={[
                  { title: t('path'), dataIndex: 'path' },
                  { title: t('value'), dataIndex: 'value' }
                ]}
              />
            )
          }
        ]}
      />
      <ActionModal
        title={pending?.type === 'rollback' ? t('rollbackTitle', { version: pending.version }) : t('saveTitle')}
        isOpen={pending !== null}
        isLoading={saveState.isLoading || rollbackState.isLoading}
        onSubmit={submit}
        onCancel={() => setPending(null)}
      />
    </Space>
  )
}
