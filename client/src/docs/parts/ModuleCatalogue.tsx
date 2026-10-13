'use client'

import { useTranslations } from 'next-intl'
import { useModuleName } from '../../features/factory/useModuleName'
import catalogue from '../generated/catalogue.json'

// The modules that exist with the numbers of a new one, from the module catalog (npm run docs:generate)
export default function ModuleCatalogue() {
  const t = useTranslations('docs.catalogue')
  const moduleName = useModuleName()

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>{t('module')}</th>
          <th>{t('weight')}</th>
          <th>{t('operationCost')}</th>
          <th>{t('idleCost')}</th>
          <th>{t('condition')}</th>
          <th>{t('properties')}</th>
        </tr>
      </thead>
      <tbody>
        {catalogue.modules.map((module) => (
          <tr key={module.name} id={`module-${module.name}`}>
            <td>{moduleName(module.name)}</td>
            <td>{module.weight}</td>
            <td>{module.operationCost}</td>
            <td>{module.idleCost}</td>
            <td>{module.maxCondition}</td>
            <td>
              {Object.entries(module.props)
                .map(([name, value]) => `${t(`props.${name}`)}: ${value}`)
                .join('; ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
