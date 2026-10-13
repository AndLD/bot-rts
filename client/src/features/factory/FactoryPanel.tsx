'use client'

import { Button, Checkbox, Input, InputNumber, Tabs, Tag } from 'antd'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  useBotControlGetStorageQuery,
  useCraftingRecipeListQuery,
  useFactoryAssembleMutation,
  useFactoryCraftMutation,
  useFactoryLearnMutation,
  useFactoryResearchMutation,
  useFactoryStatusQuery
} from '../../shared/api'
import HelpLink from '../../docs/HelpLink'
import ModuleHelpName from '../../docs/ModuleHelpName'
import { useGameNames } from '../map/useGameNames'
import { useModuleName } from './useModuleName'
import { useServerClock } from './useServerClock'

const REFRESH_MS = 2000

type Cost = Array<{ resource: string; amount: number }>

// The factory of a base (design §9.3, §8.2): craft modules from the base's resources, research the blueprints of higher
// classes, learn found blueprints, and assemble finished modules into a bot
export default function FactoryPanel({ baseId }: { baseId: string }) {
  const t = useTranslations('factory')
  const moduleName = useModuleName()
  const names = useGameNames()
  const { data: recipes } = useCraftingRecipeListQuery(undefined, { pollingInterval: REFRESH_MS })
  const { data: status } = useFactoryStatusQuery({ baseId }, { pollingInterval: REFRESH_MS })
  const { data: storage } = useBotControlGetStorageQuery({ botId: baseId }, { pollingInterval: REFRESH_MS })
  const [craft] = useFactoryCraftMutation()
  const [research] = useFactoryResearchMutation()
  const [learn] = useFactoryLearnMutation()
  const [assemble] = useFactoryAssembleMutation()
  const now = useServerClock(status?.now)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [picked, setPicked] = useState<string[]>([])
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const stock = new Map<string, number>((storage?.resources ?? []).map(({ resource, amount }) => [resource, amount]))
  const canAfford = (cost: Cost, times = 1) =>
    cost.every(({ resource, amount }) => (stock.get(resource) ?? 0) >= amount * times)

  async function run(action: () => Promise<{ error?: unknown }>, done: string) {
    const response = await action()

    setMessage(
      response.error
        ? {
            text: t('failed', { code: (response.error as { data?: { code?: string } }).data?.code ?? '' }),
            isError: true
          }
        : { text: done, isError: false }
    )
    return !response.error
  }

  const costTags = (cost: Cost, times = 1) =>
    cost.map(({ resource, amount }) => (
      <Tag key={resource} color={(stock.get(resource) ?? 0) >= amount * times ? 'default' : 'error'}>
        {names.resource(resource)} {amount * times}
      </Tag>
    ))

  if (!recipes || !status) {
    return <div style={{ padding: 10 }}>{t('loading')}</div>
  }

  const seconds = (ms: number) => Math.ceil(ms / 1000)

  const craftTab = (
    <div>
      <HelpLink slug="getting-started/first-bot" />
      {status.jobs.length > 0 && (
        <>
          <h4>{t('jobs')}</h4>
          <ul>
            {status.jobs.map((job, index) => (
              <li key={`${job.module}-${index}`}>
                {t(`jobKinds.${job.kind}`)} {moduleName(job.module)}:{' '}
                {now !== undefined && job.readyAt > now
                  ? t('readyIn', { seconds: seconds(job.readyAt - now) })
                  : t('ready')}
              </li>
            ))}
          </ul>
        </>
      )}

      {status.blueprintItems.length > 0 && (
        <>
          <h4>{t('blueprints')}</h4>
          <ul>
            {status.blueprintItems.map((item) => (
              <li key={item._id}>
                {moduleName(item.name)}{' '}
                <Button
                  size="small"
                  onClick={() =>
                    run(
                      () => learn({ baseId, learnDto: { itemId: item._id } }),
                      t('learned', { module: moduleName(item.name) })
                    )
                  }
                >
                  {t('learn')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>{t('recipes')}</h4>
      {recipes.map((recipe) => {
        const count = counts[recipe.module] ?? 1

        return (
          <div key={recipe.module} className="factory-recipe" style={{ marginBottom: 8 }}>
            <ModuleHelpName module={recipe.module} /> <span>{t('time', { seconds: seconds(recipe.craftTimeMs) })}</span>
            <div>{costTags(recipe.resources, recipe.isKnown ? count : 1)}</div>
            {recipe.isKnown ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <InputNumber
                  size="small"
                  min={1}
                  max={100}
                  value={count}
                  aria-label={t('count', { module: moduleName(recipe.module) })}
                  onChange={(value) => setCounts({ ...counts, [recipe.module]: value ?? 1 })}
                />
                <Button
                  size="small"
                  type="primary"
                  disabled={!canAfford(recipe.resources, count)}
                  onClick={() =>
                    run(
                      () => craft({ baseId, craftDto: { module: recipe.module, count } }),
                      t('crafting', { module: moduleName(recipe.module) })
                    )
                  }
                >
                  {t('craft')}
                </Button>
              </div>
            ) : recipe.research ? (
              <div>
                <div>
                  {t('research')}: {costTags(recipe.research.resources)}{' '}
                  {t('time', { seconds: seconds(recipe.research.timeMs) })}
                </div>
                <Button
                  size="small"
                  disabled={!recipe.canResearch || !canAfford(recipe.research.resources)}
                  onClick={() =>
                    run(
                      () => research({ baseId, researchDto: { module: recipe.module } }),
                      t('researching', { module: moduleName(recipe.module) })
                    )
                  }
                >
                  {t('research')}
                </Button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )

  const assembleTab = (
    <div>
      <h4>{t('parts')}</h4>
      {status.parts.length ? (
        <Checkbox.Group
          value={picked}
          onChange={(values) => setPicked(values as string[])}
          style={{ display: 'grid', gap: 4 }}
        >
          {status.parts.map((part) => (
            <Checkbox key={part._id} value={part._id}>
              {moduleName(part.name)}
            </Checkbox>
          ))}
        </Checkbox.Group>
      ) : (
        <div>{t('noParts')}</div>
      )}
      <Input
        style={{ marginTop: 8 }}
        placeholder={t('label')}
        aria-label={t('label')}
        value={label}
        maxLength={40}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Button
        style={{ marginTop: 8 }}
        type="primary"
        disabled={!picked.length}
        onClick={async () => {
          const isDone = await run(
            () => assemble({ baseId, assembleDto: { label: label || undefined, partIds: picked } }),
            t('assembled')
          )
          if (isDone) {
            setPicked([])
            setLabel('')
          }
        }}
      >
        {t('assemble')}
      </Button>
    </div>
  )

  return (
    <div className="factory-panel" style={{ padding: 10 }}>
      <Tabs
        size="small"
        items={[
          { key: 'craft', label: t('craftTab'), children: craftTab },
          { key: 'assemble', label: t('assembleTab'), children: assembleTab }
        ]}
      />
      {message && (
        <div role="status" style={{ color: message.isError ? '#f87171' : '#86efac' }}>
          {message.text}
        </div>
      )}
    </div>
  )
}
