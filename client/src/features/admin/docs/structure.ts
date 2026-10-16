import type { DocBlock } from '../../../docs/structure'

// The documentation of the admin console as data (design §25.3, Docs): a tree of pages, each a list of blocks, with the texts as
// translation keys under `adminDocs.pages.<id>.<key>`. It uses the blocks and the search of the player documentation; what the code
// knows (the permissions, the audited actions, the alert thresholds) is rendered from generated data.

export type AdminDocGroup = 'start' | 'pages' | 'procedures' | 'reference'

export type AdminGeneratedKind = 'permissions' | 'auditActions' | 'alerts'

export type AdminDocBlock =
  Exclude<DocBlock, { type: 'generated' | 'faq' }> | { type: 'generated'; kind: AdminGeneratedKind }

export interface AdminDocPage {
  // The address inside /admin/docs ('' is the front page)
  slug: string
  id: string
  group: AdminDocGroup
  blocks: readonly AdminDocBlock[]
}

export const ADMIN_DOC_GROUPS: readonly AdminDocGroup[] = ['start', 'pages', 'procedures', 'reference']

const intro: AdminDocBlock = { type: 'paragraph', key: 'intro' }
const list = (...keys: string[]): AdminDocBlock => ({ type: 'list', keys })
const heading = (key: string): AdminDocBlock => ({ type: 'heading', key })
const see = (...slugs: string[]): AdminDocBlock[] => slugs.map((slug) => ({ type: 'see', slug }))

// A page of the console: what it shows, then what can be done on it
function consolePage(id: string, actions: number, ...related: string[]): AdminDocPage {
  return {
    slug: id,
    id,
    group: 'pages',
    blocks: [
      intro,
      heading('actionsTitle'),
      list(...Array.from({ length: actions }, (_, index) => `action${index + 1}`)),
      ...see(...related)
    ]
  }
}

export const ADMIN_DOC_PAGES: readonly AdminDocPage[] = [
  {
    slug: '',
    id: 'home',
    group: 'start',
    blocks: [
      { type: 'paragraph', key: 'lead' },
      heading('rolesTitle'),
      list('owner', 'admin', 'moderator', 'analyst'),
      { type: 'paragraph', key: 'reasons' },
      ...see('signing-in', 'permissions')
    ]
  },
  {
    slug: 'signing-in',
    id: 'signingIn',
    group: 'start',
    blocks: [intro, list('step1', 'step2', 'step3'), heading('recoveryTitle'), { type: 'paragraph', key: 'recovery' }]
  },
  consolePage('dashboard', 3, 'alerts'),
  consolePage('players', 7, 'moderation', 'security'),
  consolePage('inspector', 4, 'map'),
  consolePage('map', 3, 'inspector'),
  consolePage('supervision', 6, 'maintenance'),
  consolePage('security', 4, 'moderation'),
  consolePage('economy', 5, 'analytics'),
  consolePage('operations', 6, 'maintenance'),
  consolePage('analytics', 3, 'economy'),
  consolePage('logs', 5, 'audit-actions'),
  consolePage('game-time', 4, 'operations'),
  consolePage('devtools', 4),
  consolePage('docs', 2),
  {
    slug: 'maintenance',
    id: 'maintenance',
    group: 'procedures',
    blocks: [
      intro,
      heading('plannedTitle'),
      list('planned1', 'planned2', 'planned3', 'planned4'),
      heading('emergencyTitle'),
      list('emergency1', 'emergency2', 'emergency3'),
      ...see('supervision', 'operations')
    ]
  },
  {
    slug: 'moderation',
    id: 'moderation',
    group: 'procedures',
    blocks: [
      intro,
      list('rule1', 'rule2', 'rule3', 'rule4', 'rule5'),
      { type: 'paragraph', key: 'outro' },
      ...see('players', 'security')
    ]
  },
  {
    slug: 'permissions',
    id: 'permissions',
    group: 'reference',
    blocks: [intro, { type: 'generated', kind: 'permissions' }]
  },
  {
    slug: 'audit-actions',
    id: 'auditActions',
    group: 'reference',
    blocks: [intro, { type: 'generated', kind: 'auditActions' }, ...see('logs')]
  },
  {
    slug: 'alerts',
    id: 'alerts',
    group: 'reference',
    blocks: [intro, { type: 'generated', kind: 'alerts' }, ...see('dashboard')]
  }
]

export const findAdminDocPage = (slug: string): AdminDocPage | undefined =>
  ADMIN_DOC_PAGES.find((page) => page.slug === slug)

export const adminPagesOfGroup = (group: AdminDocGroup): AdminDocPage[] =>
  ADMIN_DOC_PAGES.filter((page) => page.group === group)

// The page of the documentation for each page of the console; a test fails when a page of the console has none
export const ADMIN_PAGE_DOCS: Readonly<Record<string, string>> = {
  '/admin': 'dashboard',
  '/admin/players': 'players',
  '/admin/inspector': 'inspector',
  '/admin/map': 'map',
  '/admin/supervision': 'supervision',
  '/admin/security': 'security',
  '/admin/economy': 'economy',
  '/admin/analytics': 'analytics',
  '/admin/operations': 'operations',
  '/admin/game-time': 'game-time',
  '/admin/logs': 'logs',
  '/admin/devtools': 'devtools',
  '/admin/docs': 'docs'
}

// The documentation of the page the admin is on: the longest address that matches (a player's profile is under /admin/players)
export function docSlugOfPath(pathname: string): string {
  const match = Object.keys(ADMIN_PAGE_DOCS)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]

  return match ? ADMIN_PAGE_DOCS[match] : ''
}
