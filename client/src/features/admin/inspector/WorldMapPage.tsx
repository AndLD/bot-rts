'use client'

import { Card, Col, Empty, List, Row, Segmented, Select, Space } from 'antd'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IMapView } from '@lib/utils/interfaces/map'
import { HEATMAP_BUCKETS, HEATMAP_KINDS, HeatmapKind } from '@lib/utils/admin-inspector'
import { api, useInspectorHeatmapQuery } from '../../../shared/api'
import { useAppDispatch } from '../../../shared/store/hooks'
import MapCanvas from '../../map/MapCanvas'
import { MapStore } from '../../map/MapStore'
import { TileLoader } from '../../map/TileLoader'
import { useReducedMotion } from '../../map/useReducedMotion'
import HeatGrid from './HeatGrid'
import { useEventTail } from './useEventTail'

// The heatmap covers this many cells around the point the map was opened on
const HEATMAP_SIDE = 256

const numberParam = (value: string | null) => (value !== null && Number.isFinite(Number(value)) ? Number(value) : 0)

// The whole world without fog of war (design §25.3), drawn by the map renderer of the game; heatmaps and the live event tail beside it
export default function WorldMapPage() {
  const t = useTranslations('admin.map')
  const router = useRouter()
  const params = useSearchParams()
  const dispatch = useAppDispatch()
  const isReducedMotion = useReducedMotion()
  const center = { x: numberParam(params.get('x')), y: numberParam(params.get('y')) }
  const [kind, setKind] = useState<HeatmapKind>('density')
  const [bucket, setBucket] = useState<(typeof HEATMAP_BUCKETS)[number]>(16)
  const events = useEventTail()
  const { store, loader } = useMemo(() => {
    const mapStore = new MapStore()
    const request = (range: Parameters<TileLoader['ensure']>[0]) =>
      dispatch(
        api.endpoints.inspectorMap.initiate(range, { subscribe: false, forceRefetch: true })
      ).unwrap() as Promise<IMapView>

    return { store: mapStore, loader: new TileLoader(request, mapStore) }
  }, [dispatch])
  const area = { minX: center.x - HEATMAP_SIDE / 2, minY: center.y - HEATMAP_SIDE / 2, side: HEATMAP_SIDE }
  const { data: heatmap } = useInspectorHeatmapQuery({
    minX: area.minX,
    minY: area.minY,
    maxX: area.minX + HEATMAP_SIDE - 1,
    maxY: area.minY + HEATMAP_SIDE - 1,
    kind,
    bucket
  })

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <div style={{ height: '70vh' }}>
          <MapCanvas
            store={store}
            loader={loader}
            center={center}
            isReducedMotion={isReducedMotion}
            onOpenBot={(botId) => router.push(`/admin/inspector/${botId}`)}
          />
        </div>
      </Col>
      <Col xs={24} xl={8}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card size="small" title={t('heatmap')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Segmented
                value={kind}
                onChange={(value) => setKind(value as HeatmapKind)}
                options={HEATMAP_KINDS.map((value) => ({ value, label: t(`kind.${value}`) }))}
              />
              <Select
                value={bucket}
                onChange={setBucket}
                options={HEATMAP_BUCKETS.map((value) => ({ value, label: t('bucket', { cells: value }) }))}
              />
              {heatmap ? <HeatGrid heatmap={heatmap} area={area} label={t(`kind.${kind}`)} /> : null}
            </Space>
          </Card>
          <Card size="small" title={t('tail')}>
            <List
              size="small"
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noEvents')} /> }}
              dataSource={events}
              style={{ maxHeight: 320, overflow: 'auto' }}
              renderItem={({ userId, event }) => (
                <List.Item>
                  <code>{`${event.type} · ${userId.slice(0, 8)}${event.location ? ` · (${event.location.x}, ${event.location.y})` : ''}`}</code>
                </List.Item>
              )}
            />
          </Card>
        </Space>
      </Col>
    </Row>
  )
}
