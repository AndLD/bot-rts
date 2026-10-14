'use client'

import { Alert, Empty, Input, List, Space, Tag } from 'antd'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IInspectorSearchResult } from '@lib/utils/admin-inspector'
import { useInspectorSearchQuery } from '../../../shared/api'
import { useErrorMessage } from '../../../shared/errors'

// Where a search result leads: a bot or a base to the inspector, a player to the Players page, a cell to the map
function hrefOf(result: IInspectorSearchResult): string | null {
  switch (result.kind) {
    case 'bot':
    case 'base':
      return `/admin/inspector/${result.id}`
    case 'player':
      return `/admin/players/${result.id}`
    default:
      return result.id ? `/admin/inspector/${result.id}` : `/admin/map?x=${result.x}&y=${result.y}`
  }
}

// Finds any base, bot, player or cell by id or coordinates (design §25.3)
export default function InspectorPage() {
  const t = useTranslations('admin.inspector')
  const getErrorMessage = useErrorMessage()
  const [query, setQuery] = useState('')
  const { data, error, isFetching } = useInspectorSearchQuery({ q: query }, { skip: !query })
  const failure = (error as { data?: { code?: string; error?: string } } | undefined)?.data

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Input.Search
        allowClear
        placeholder={t('search')}
        loading={isFetching}
        onSearch={setQuery}
        style={{ maxWidth: 480 }}
      />
      {error ? (
        <Alert type="error" message={getErrorMessage({ code: failure?.code, message: failure?.error })} />
      ) : null}
      {query && data ? (
        <List
          bordered
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('nothing')} /> }}
          dataSource={data}
          renderItem={(result) => (
            <List.Item>
              <Space>
                <Tag>{t(`kind.${result.kind}`)}</Tag>
                <Link href={hrefOf(result) as string}>{result.label}</Link>
                {result.x !== null ? (
                  <span>
                    ({result.x}, {result.y})
                  </span>
                ) : null}
              </Space>
            </List.Item>
          )}
        />
      ) : null}
    </Space>
  )
}
