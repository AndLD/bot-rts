// Checks the message catalogues of the client (client/messages/*.json) against the code:
//  - every static key passed to `t('…')` exists in the English catalogue (English is the source of the texts),
//  - no other catalogue has a key that English lacks,
//  - every error code of `lib` has a translated `errors.<CODE>` message,
//  - every message is valid ICU MessageFormat (for example a stray `{` is an error),
//  - unused English keys and the share of translated keys per language are reported.
// A file uses one namespace for `useTranslations('namespace')`, and the keys it passes to `t` are relative to that namespace.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { IntlMessageFormat } from 'intl-messageformat'

const root = resolve(import.meta.dirname, '..')
const client = join(root, 'client')

function flatten(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  )
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

const messageTexts = []

function collectTexts(object, language, prefix = '') {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'object' && value !== null) {
      collectTexts(value, language, `${prefix}${key}.`)
    } else {
      messageTexts.push({ language, key: `${prefix}${key}`, text: value })
    }
  }
}

const catalogues = Object.fromEntries(
  readdirSync(join(client, 'messages'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const language = name.replace('.json', '')
      const messages = JSON.parse(readFileSync(join(client, 'messages', name), 'utf8'))
      collectTexts(messages, language)
      return [language, new Set(flatten(messages))]
    })
)
const english = catalogues.en
const errors = []
const used = new Set()

for (const file of sourceFiles(join(client, 'src'))) {
  const text = readFileSync(file, 'utf8')
  const namespaces = [
    ...new Set([...text.matchAll(/useTranslations\(\s*(?:'([^']*)')?\s*\)/g)].map((match) => match[1] ?? ''))
  ]
  const keys = [...text.matchAll(/(?<![\w.])t\(\s*'([^']+)'/g)].map((match) => match[1])

  if (namespaces.length > 1) {
    errors.push(
      `${relative(root, file)}: useTranslations is called with different namespaces; use one namespace per file`
    )
    continue
  }

  for (const key of keys) {
    const full = namespaces[0] ? `${namespaces[0]}.${key}` : key
    used.add(full)

    if (!english.has(full)) {
      errors.push(`${relative(root, file)}: the key "${full}" is not in messages/en.json`)
    }
  }
}

for (const [language, keys] of Object.entries(catalogues)) {
  for (const key of keys) {
    if (!english.has(key)) {
      errors.push(`messages/${language}.json: the key "${key}" does not exist in messages/en.json`)
    }
  }
}

for (const { language, key, text } of messageTexts) {
  try {
    new IntlMessageFormat(text, language)
  } catch (error) {
    errors.push(`messages/${language}.json: "${key}" is not valid ICU MessageFormat (${error.message})`)
  }
}

const errorCodes = [...readFileSync(join(root, 'lib/utils/error-codes.ts'), 'utf8').matchAll(/^\s+([A-Z_]+): '/gm)].map(
  (match) => match[1]
)
for (const code of errorCodes) {
  if (!english.has(`errors.${code}`)) {
    errors.push(`messages/en.json: no message for the API error code ${code} (errors.${code})`)
  }
}

// Every key of the English catalogue must exist in every other language: a missing translation fails the check on every pull request
for (const [language, keys] of Object.entries(catalogues)) {
  if (language === 'en') {
    continue
  }
  for (const key of english) {
    if (!keys.has(key)) {
      errors.push(`messages/${language}.json: the key "${key}" is not translated`)
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const unused = [...english].filter((key) => !used.has(key) && !key.startsWith('errors.'))
if (unused.length) {
  console.warn(`Not referenced by a literal t('…') call (they may be built dynamically): ${unused.join(', ')}`)
}

for (const [language, keys] of Object.entries(catalogues)) {
  console.log(`${language}: ${keys.size}/${english.size} keys translated`)
}
