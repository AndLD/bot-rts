'use client'

import { useTranslations } from 'next-intl'
import DocLink from './DocLink'
import catalogue from './generated/catalogue.json'
import { DocPage } from './structure'
import CommandReference from './parts/CommandReference'
import DocsIndex from './parts/DocsIndex'
import ExamplesGallery from './parts/ExamplesGallery'
import ModuleCatalogue from './parts/ModuleCatalogue'
import PublicApiLinks from './parts/PublicApiLinks'
import RecipeTable from './parts/RecipeTable'
import ScriptApiReference from './parts/ScriptApiReference'
import './docs.scss'

const GENERATED = {
  index: DocsIndex,
  scriptApi: ScriptApiReference,
  modules: ModuleCatalogue,
  recipes: RecipeTable,
  commands: CommandReference,
  examples: ExamplesGallery,
  publicApi: PublicApiLinks
}

// One page of the documentation: its blocks in order. The texts are translations, and what the code knows (the script API, the
// catalogue of modules, the recipes, the commands, the examples) is rendered from the generated data.
export default function DocPageView({ page }: { page: DocPage }) {
  const t = useTranslations('docs')
  // The numbers a text may quote come from the balance config, so they cannot drift from the game
  const text = (key: string) =>
    t(`pages.${page.id}.${key}`, {
      costFactor: catalogue.balance.researchCostFactor,
      timeFactor: catalogue.balance.researchTimeFactor
    })
  const seeAlso = page.blocks.filter((block) => block.type === 'see')

  return (
    <article className="doc-page">
      <h1>{text('title')}</h1>
      {page.blocks.map((block, index) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={index}>{text(block.key)}</p>
          case 'heading':
            return <h2 key={index}>{text(block.key)}</h2>
          case 'list':
            return (
              <ul key={index}>
                {block.keys.map((key) => (
                  <li key={key}>{text(key)}</li>
                ))}
              </ul>
            )
          case 'faq':
            return (
              <div key={index} className="doc-faq">
                {block.keys.map((key) => (
                  <details key={key}>
                    <summary>{text(`${key}.q`)}</summary>
                    <p>{text(`${key}.a`)}</p>
                  </details>
                ))}
              </div>
            )
          case 'generated': {
            const Generated = GENERATED[block.kind]

            return <Generated key={index} />
          }
          default:
            return null
        }
      })}
      {seeAlso.length > 0 && (
        <nav className="doc-see" aria-label={t('nav.readNext')}>
          <strong>{t('nav.readNext')}</strong>
          <ul>
            {seeAlso.map((block) => (
              <li key={block.type === 'see' ? block.slug : ''}>
                <DocLink slug={block.type === 'see' ? block.slug : ''} />
              </li>
            ))}
          </ul>
        </nav>
      )}
    </article>
  )
}
