import { capturePointer } from './pointer'

describe('capturePointer', () => {
  it('captures the pointer on the element', () => {
    const element = { setPointerCapture: jest.fn() } as unknown as Element

    capturePointer(element, 4)

    expect(element.setPointerCapture).toHaveBeenCalledWith(4)
  })

  it('copes with an element that cannot capture, and with a pointer that is not active', () => {
    expect(() => capturePointer({} as Element, 1)).not.toThrow()
    const refusing = {
      setPointerCapture: () => {
        throw new DOMException('No such pointer', 'NotFoundError')
      }
    } as unknown as Element

    expect(() => capturePointer(refusing, 1)).not.toThrow()
  })
})
