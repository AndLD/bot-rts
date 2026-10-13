'use client'

import { DOC_EXAMPLES } from '@lib/utils/doc-examples'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import catalogue from './generated/catalogue.json'
import commands from './generated/commands.json'
import api from './generated/script-api.json'
import { searchableTexts, searchDocs, SearchHit } from './search'
import { DOC_PAGES, DocPage } from './structure'

// Searches the documentation in the player's language, in the browser: the content is bundled, so it works offline too
export function useDocsSearch(): (query: string) => SearchHit[] {
  const t = useTranslations('docs')

  const index = useMemo(() => {
    const extras = (page: DocPage): string[] => {
      switch (page.id) {
        case 'api':
          return api.functions.flatMap((fn) => [fn.signature, t(`api.functions.${fn.name}`)])
        case 'examples':
          return DOC_EXAMPLES.flatMap((example) => [
            t(`examples.${example.id}.title`),
            t(`examples.${example.id}.description`),
            example.code
          ])
        case 'botos':
          return commands.commands.flatMap((command) => [command.usage])
        case 'modules':
          return catalogue.modules.map((module) => module.name)
        case 'recipes':
          return catalogue.recipes.map((recipe) => recipe.module)
        default:
          return []
      }
    }

    return searchableTexts(
      DOC_PAGES,
      (page) => t(`pages.${page.id}.title`),
      (page, key) => t(`pages.${page.id}.${key}`),
      extras
    )
  }, [t])

  return (query) => searchDocs(index, query)
}
