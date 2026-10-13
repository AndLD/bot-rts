'use client'

import { DOC_EXAMPLES } from '@lib/utils/doc-examples'
import { useTranslations } from 'next-intl'
import { useModuleTypeName } from '../useModuleTypeName'

// The example scripts (design §18): the code is data in `lib`, and the test suite runs every one of them in the sandbox
export default function ExamplesGallery() {
  const t = useTranslations('docs')
  const moduleTypeName = useModuleTypeName()

  return (
    <div className="doc-examples">
      {DOC_EXAMPLES.map((example) => (
        <section key={example.id} id={`example-${example.id}`}>
          <h2>{t(`examples.${example.id}.title`)}</h2>
          <p>{t(`examples.${example.id}.description`)}</p>
          <p className="doc-muted">
            {t('examples.needs', { modules: example.modules.map((module) => moduleTypeName(module)).join(', ') })}
          </p>
          <pre>
            <code>{example.code}</code>
          </pre>
        </section>
      ))}
    </div>
  )
}
