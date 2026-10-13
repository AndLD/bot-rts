import { SCENE_STEPS, sceneFrame } from './script'

const frames = Array.from({ length: SCENE_STEPS }, (_, step) => sceneFrame(step))
const types = frames.flatMap((frame) => frame.events.map((event) => event.type))

describe('sceneFrame', () => {
  it('tells the story of moving, mining, shooting and repairing', () => {
    expect(types).toEqual(expect.arrayContaining(['BotMoved', 'ResourceMined', 'ShotFired', 'ShotHit', 'ModuleBroken']))
    expect(frames.some((frame) => frame.repairs.length > 0)).toBe(true)
  })

  it('is the same every time and repeats after one cycle', () => {
    expect(sceneFrame(5)).toEqual(sceneFrame(5))
    expect(sceneFrame(5 + SCENE_STEPS)).toEqual(sceneFrame(5))
    expect(sceneFrame(-1)).toEqual(sceneFrame(SCENE_STEPS - 1))
  })

  it('moves a bot only to a different cell', () => {
    for (const frame of frames) {
      for (const event of frame.events) {
        if (event.type === 'BotMoved') {
          expect(event.from).not.toEqual(event.to)
        }
      }
    }
  })

  it('walks the miner to the deposit and back, and empties the deposit', () => {
    const botCells = (step: number) => sceneFrame(step).cells.filter((c) => c.content.kind === 'bot')
    const deposit = (step: number) => sceneFrame(step).cells.find((c) => c.x === 9 && c.y === 2)

    expect(botCells(0).some((c) => c.x === 3 && c.y === 2)).toBe(true)
    expect(botCells(9).some((c) => c.x === 8 && c.y === 2)).toBe(true)
    expect(deposit(9)?.content.kind).toBe('resource')
    expect(deposit(14)?.content.kind).toBe('empty')
  })

  it('breaks the gunner and then repairs it', () => {
    const gunner = (step: number) => sceneFrame(step).cells.find((c) => c.x === 12 && c.y === 7)?.content

    expect(gunner(10)).toMatchObject({ isDamaged: false })
    expect(gunner(16)).toMatchObject({ isDamaged: true })
    expect(gunner(26)).toMatchObject({ isDamaged: false })
  })

  it('brings the repair bot next to the gunner', () => {
    const repairer = sceneFrame(21).cells.find((c) => c.x === 11 && c.y === 8)

    expect(repairer?.content).toMatchObject({ kind: 'bot', owner: 'own' })
  })
})
