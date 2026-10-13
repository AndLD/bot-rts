'use client'

import { useTranslations } from 'next-intl'
import commands from '../generated/commands.json'
import { useCommandDescription } from '../useCommandDescription'

// The commands of BotOS, from the list the terminal serves (npm run docs:generate)
export default function CommandReference() {
  const t = useTranslations('docs.commands')
  const describe = useCommandDescription()

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>{t('syntax')}</th>
          <th>{t('description')}</th>
        </tr>
      </thead>
      <tbody>
        {commands.commands.map((command) => (
          <tr key={command.name} id={`command-${command.name}`}>
            <td>
              <code>{command.usage}</code>
            </td>
            <td>{describe(command.name)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
