// The topics `help <topic>` of the terminal knows, and the page of the documentation each opens (design §15.5)
export const HELP_TOPICS: Readonly<Record<string, string>> = {
  base: 'getting-started/first-base',
  bot: 'getting-started/first-bot',
  script: 'getting-started/first-script',
  map: 'concepts/map',
  ticks: 'concepts/ticks',
  energy: 'concepts/energy',
  ops: 'concepts/ops-budget',
  weight: 'concepts/weight',
  api: 'api',
  modules: 'modules',
  recipes: 'recipes',
  commands: 'botos',
  examples: 'examples',
  faq: 'faq'
}

// The page of a topic, or null when the topic is not one of them
export function helpSlugOf(topic: string): string | null {
  const name = topic.trim().toLowerCase()

  return Object.prototype.hasOwnProperty.call(HELP_TOPICS, name) ? HELP_TOPICS[name] : null
}
