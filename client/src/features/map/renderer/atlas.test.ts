import { browserLoaders, loadAtlas, parseAtlasIndex } from './atlas'

const frames = { ground: { x: 0, y: 0, w: 32, h: 32 } }

describe('atlas', () => {
  it('accepts a well-formed index', () => {
    expect(parseAtlasIndex({ image: 'a.png', tileSize: 32, frames })).toEqual({ image: 'a.png', tileSize: 32, frames })
  })

  it.each([
    ['nothing', null],
    ['no image', { tileSize: 32, frames }],
    ['no tile size', { image: 'a.png', frames }],
    ['no frames', { image: 'a.png', tileSize: 32 }],
    ['an empty frame', { image: 'a.png', tileSize: 32, frames: { ground: null } }],
    ['a frame without numbers', { image: 'a.png', tileSize: 32, frames: { ground: { x: 0, y: 0, w: 'x', h: 1 } } }]
  ])('rejects %s', (_name, raw) => {
    expect(() => parseAtlasIndex(raw)).toThrow('Invalid atlas')
  })

  it('loads the image that sits next to the index', async () => {
    const image = {} as CanvasImageSource
    const loaders = {
      fetchJson: jest.fn().mockResolvedValue({ image: 'atlas.svg', tileSize: 32, frames }),
      loadImage: jest.fn().mockResolvedValue(image)
    }

    const atlas = await loadAtlas('/atlas/atlas.json', loaders)

    expect(loaders.loadImage).toHaveBeenCalledWith('/atlas/atlas.svg')
    expect(atlas?.image).toBe(image)
    expect(atlas?.frame('ground')).toEqual(frames.ground)
    expect(atlas?.frame('nope')).toBeUndefined()
  })

  it('gives null when anything fails, so the map falls back to colours', async () => {
    const loaders = { fetchJson: jest.fn().mockRejectedValue(new Error('404')), loadImage: jest.fn() }

    expect(await loadAtlas('/atlas/atlas.json', loaders)).toBeNull()
  })

  describe('browser loaders', () => {
    afterEach(() => jest.restoreAllMocks())

    it('fetches the index as JSON', async () => {
      global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: 1 }) })

      expect(await browserLoaders.fetchJson('/a.json')).toEqual({ ok: 1 })
    })

    it.each([
      ['onload', true],
      ['onerror', false]
    ])('loads an image (%s)', async (event, isLoaded) => {
      class FakeImage {
        onload: () => void = () => undefined
        onerror: () => void = () => undefined
        set src(_value: string) {
          if (event === 'onload') this.onload()
          else this.onerror()
        }
      }
      jest.spyOn(global, 'Image').mockImplementation(() => new FakeImage() as unknown as HTMLImageElement)

      const result = browserLoaders.loadImage('/a.svg')

      if (isLoaded) {
        expect(await result).toBeInstanceOf(FakeImage)
      } else {
        await expect(result).rejects.toThrow('Cannot load /a.svg')
      }
    })
  })
})
