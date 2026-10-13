'use client'

import { useTranslations } from 'next-intl'
import { useModuleName } from '../../features/factory/useModuleName'
import { useGameNames } from '../../features/map/useGameNames'
import catalogue from '../generated/catalogue.json'

// What crafting each module costs, from the recipes of the balance config (npm run docs:generate)
export default function RecipeTable() {
  const t = useTranslations('docs.catalogue')
  const moduleName = useModuleName()
  const names = useGameNames()

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>{t('module')}</th>
          <th>{t('class')}</th>
          <th>{t('resources')}</th>
          <th>{t('time')}</th>
        </tr>
      </thead>
      <tbody>
        {catalogue.recipes.map((recipe) => (
          <tr key={recipe.module} id={`recipe-${recipe.module}`}>
            <td>{moduleName(recipe.module)}</td>
            <td>{recipe.classLevel}</td>
            <td>
              {recipe.resources.map(({ resource, amount }) => `${amount} ${names.resource(resource)}`).join(', ')}
            </td>
            <td>{t('seconds', { seconds: recipe.craftTimeMs / 1000 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
