// A Canvas 2D context that records its calls: jsdom has no canvas
export type FakeContext = CanvasRenderingContext2D & {
  calls: Array<[string, ...unknown[]]>
  called(name: string): unknown[][]
}

const METHODS = [
  'fillRect',
  'strokeRect',
  'clearRect',
  'drawImage',
  'setTransform',
  'save',
  'restore',
  'beginPath',
  'rect',
  'clip',
  'moveTo',
  'lineTo',
  'stroke',
  'setLineDash',
  'arc',
  'fill',
  'fillText',
  'closePath'
]

export function createFakeContext(): FakeContext {
  const calls: Array<[string, ...unknown[]]> = []
  const context: Record<string, unknown> = {
    calls,
    called: (name: string) => calls.filter(([n]) => n === name).map(([, ...args]) => args)
  }

  for (const method of METHODS) {
    context[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
    }
  }

  return context as unknown as FakeContext
}

export function createFakeCanvas(context: FakeContext | null = createFakeContext()) {
  return { width: 0, height: 0, getContext: jest.fn(() => context) } as unknown as HTMLCanvasElement
}
