'use client'

import { useTranslations } from 'next-intl'
import api from '../generated/script-api.json'
import { useModuleTypeName } from '../useModuleTypeName'

// The functions of the script API, from the catalog the engine enforces (npm run docs:generate): what each takes, which modules grant it
// and what a call costs
export default function ScriptApiReference() {
  const t = useTranslations('docs')
  const moduleTypeName = useModuleTypeName()

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>{t('api.function')}</th>
          <th>{t('api.description')}</th>
          <th>{t('api.needs')}</th>
          <th>{t('api.ops')}</th>
        </tr>
      </thead>
      <tbody>
        {api.functions.map((fn) => (
          <tr key={fn.name} id={`fn-${fn.name}`}>
            <td>
              <code>{fn.signature}</code>
            </td>
            <td>{t(`api.functions.${fn.name}`)}</td>
            <td>
              {fn.modules.length === 0 ? t('api.every') : fn.modules.map((module) => moduleTypeName(module)).join(', ')}
            </td>
            <td>{fn.ops}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
