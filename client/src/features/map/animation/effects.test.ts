import { createFakeContext } from '../../../../tests/canvas'
import { dust, flash, floatingText, highlight, lowEnergy, ring, shot, smoke } from './effects'
import { Effect, Painter } from './painter'

function paint(effect: Effect, progress: number) {
  const context = createFakeContext()
  const painter: Painter = {
    context,
    cellSize: 32,
    cellToScreen: (x, y) => ({ x: x * 32, y: y * 32 })
  }
  effect.draw(painter, progress)

  return context
}

const spot = { x: 2, y: 3 }

describe('effects', () => {
  it('draws a tracer between the shooter and the target, with a flash and a spark', () => {
    const context = paint(shot(0, spot, { x: 6, y: 3 }), 0.5)

    expect(context.called('moveTo')).toEqual([[80, 112]])
    expect(context.called('lineTo')).toEqual([[208, 112]])
    expect(context.called('arc')).toHaveLength(2)
    expect(context.called('save')).toHaveLength(1)
    expect(context.called('restore')).toHaveLength(1)
  })

  it('floats a number up and fades it', () => {
    const early = paint(floatingText(0, spot, '-2', '#f00'), 0)
    const late = paint(floatingText(0, spot, '-2', '#f00'), 0.9)

    expect(early.called('fillText')[0][0]).toBe('-2')
    expect((late.called('fillText')[0][2] as number) < (early.called('fillText')[0][2] as number)).toBe(true)
  })

  it('throws up the same dust every frame of one event', () => {
    const first = paint(dust(0, spot, 7), 0.4)
    const again = paint(dust(0, spot, 7), 0.4)

    expect(first.called('arc')).toHaveLength(6)
    expect(first.called('arc')).toEqual(again.called('arc'))
  })

  it('grows a ring', () => {
    const small = paint(ring(0, spot, 3, '#fff'), 0.1).called('arc')[0][2] as number
    const large = paint(ring(0, spot, 3, '#fff'), 0.9).called('arc')[0][2] as number

    expect(large).toBeGreaterThan(small)
  })

  it('raises smoke, flashes a cell and blinks the energy icon', () => {
    expect(paint(smoke(0, spot, 3), 0.5).called('arc')).toHaveLength(4)
    expect(paint(flash(0, spot, '#f00'), 0.2).called('fillRect')).toEqual([[64, 96, 32, 32]])
    expect(paint(lowEnergy(0, spot), 0).called('fillText')).toHaveLength(1)
    expect(paint(lowEnergy(0, spot), 0.2).called('fillText')).toHaveLength(0)
  })

  it('outlines a cell without moving anything', () => {
    const context = paint(highlight(0, spot, '#ff0'), 0.5)

    expect(context.called('strokeRect')).toEqual([[65, 97, 30, 30]])
  })
})
