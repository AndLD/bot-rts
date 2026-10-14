'use client'

import { Alert, Input, Select, Space, Table, Tag } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import Link from 'next/link'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { IPlayerListItem, PlayerSort } from '@lib/utils/admin-players'
import { USER_STATUSES, UserStatus } from '@lib/utils/interfaces/users'
import { usePlayersSearchQuery } from '../../../shared/api'

const PAGE_SIZE = 20

export const STATUS_COLOR: Record<UserStatus, string> = {
  owner: 'purple',
  admin: 'geekblue',
  moderator: 'blue',
  analyst: 'cyan',
  user: 'default',
  unlimited: 'green',
  banned: 'red'
}

// The players with server-side search and typed filters (design §25.3); a row opens the profile
export default function PlayersPage() {
  const t = useTranslations('admin.players')
  const format = useFormatter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<UserStatus | undefined>()
  const [isVerified, setVerified] = useState<boolean | undefined>()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ field: PlayerSort; order: 'asc' | 'desc' }>({ field: 'createdAt', order: 'desc' })
  const { data, isFetching, isError } = usePlayersSearchQuery({
    page,
    results: PAGE_SIZE,
    q: query || undefined,
    status,
    isEmailVerified: isVerified,
    sort: sort.field,
    order: sort.order
  })
  const date = (ms: number | null) =>
    ms === null ? '–' : format.dateTime(new Date(ms), { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Input.Search
          allowClear
          placeholder={t('search')}
          style={{ width: 280 }}
          onSearch={(value) => {
            setQuery(value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          placeholder={t('filters.status')}
          style={{ width: 160 }}
          options={USER_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
          onChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        />
        <Select
          allowClear
          placeholder={t('filters.verified')}
          style={{ width: 180 }}
          options={[
            { value: true, label: t('filters.verifiedYes') },
            { value: false, label: t('filters.verifiedNo') }
          ]}
          onChange={(value) => {
            setVerified(value)
            setPage(1)
          }}
        />
      </Space>
      {isError ? <Alert type="error" message={t('loadFailed')} /> : null}
      <Table<IPlayerListItem>
        rowKey="_id"
        loading={isFetching}
        dataSource={data?.result ?? []}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total: data?.meta.pagination.total ?? 0,
          showSizeChanger: false
        }}
        onChange={(pagination, _filters, sorter) => {
          setPage(pagination.current as number)
          const single = ([] as SorterResult<IPlayerListItem>[]).concat(sorter)[0]
          if (single?.order && single.field) {
            setSort({ field: single.field as PlayerSort, order: single.order === 'ascend' ? 'asc' : 'desc' })
          }
        }}
        columns={[
          {
            title: t('columns.name'),
            dataIndex: 'name',
            sorter: true,
            render: (name: string, row) => <Link href={`/admin/players/${row._id}`}>{name}</Link>
          },
          { title: t('columns.email'), dataIndex: 'email', sorter: true },
          {
            title: t('columns.status'),
            dataIndex: 'status',
            render: (value: UserStatus) => <Tag color={STATUS_COLOR[value]}>{t(`status.${value}`)}</Tag>
          },
          {
            title: t('columns.verified'),
            dataIndex: 'isEmailVerified',
            render: (value: boolean) => (value ? t('filters.verifiedYes') : t('filters.verifiedNo'))
          },
          { title: t('columns.registered'), dataIndex: 'createdAt', sorter: true, render: date },
          { title: t('columns.lastLogin'), dataIndex: 'lastLoginAt', render: date }
        ]}
      />
    </Space>
  )
}
