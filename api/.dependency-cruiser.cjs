// Import-boundary rules of docs/engineering/stack.md §2.1–2.2, checked for the layered code in api/src (`npm run check:boundaries`).
// Layers are the folders domain / application / infrastructure / presentation of every feature; `*.module.ts` files,
// `app.*`, `bootstrap.ts` and `legacy/` are composition code and may import everything.
const layer = (name) => `^src/[^/]+/${name}/`
const notTest = '\\.test\\.ts$'

module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'The domain imports no other layer and no npm package (only lib and itself)',
      severity: 'error',
      from: { path: layer('domain'), pathNot: notTest },
      to: { path: [layer('application'), layer('infrastructure'), layer('presentation')] }
    },
    {
      name: 'domain-has-no-packages',
      severity: 'error',
      from: { path: layer('domain'), pathNot: notTest },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'core'] }
    },
    {
      name: 'application-depends-inward',
      comment: 'Use cases know ports and the domain, never adapters or transport',
      severity: 'error',
      from: { path: layer('application'), pathNot: notTest },
      to: { path: [layer('infrastructure'), layer('presentation')] }
    },
    {
      name: 'application-has-no-packages',
      comment: 'No Express, Socket.IO, Prisma or Nest in use cases (dependency injection is wired in the modules)',
      severity: 'error',
      from: { path: layer('application'), pathNot: notTest },
      to: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] }
    },
    {
      name: 'presentation-uses-use-cases',
      comment: 'Controllers never touch adapters or the database',
      severity: 'error',
      from: { path: layer('presentation'), pathNot: notTest },
      to: { path: layer('infrastructure') }
    },
    {
      name: 'infrastructure-does-not-know-transport',
      severity: 'error',
      from: { path: layer('infrastructure'), pathNot: notTest },
      to: { path: layer('presentation') }
    },
    {
      name: 'prisma-stays-in-infrastructure',
      comment: 'AGENTS.md §3.4: Prisma lives only in the persistence adapters (and their modules)',
      severity: 'error',
      from: { path: '^src/', pathNot: [layer('infrastructure'), '\\.module\\.ts$', notTest] },
      to: { path: 'node_modules/(@prisma|\\.prisma)/' }
    },
    {
      name: 'lib-is-independent',
      severity: 'error',
      from: { path: '^\\.\\./lib/' },
      to: { path: '^(src|middlewares|controllers|routers|setup|utils)/' }
    }
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: notTest },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] }
  }
}
