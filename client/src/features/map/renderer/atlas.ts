// The sprite atlas: one image and a JSON index of named frames (design §4.3)

export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasIndex {
  image: string
  tileSize: number
  frames: Record<string, AtlasFrame>
}

export interface Atlas {
  image: CanvasImageSource
  tileSize: number
  frame(name: string): AtlasFrame | undefined
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

// Checks the shape of a loaded index; a bad file is an error, not a silently broken map
export function parseAtlasIndex(raw: unknown): AtlasIndex {
  const index = raw as Partial<AtlasIndex> | null

  if (!index || typeof index.image !== 'string' || !isNumber(index.tileSize) || !index.frames) {
    throw new Error('Invalid atlas index')
  }

  for (const frame of Object.values(index.frames)) {
    if (!frame || ![frame.x, frame.y, frame.w, frame.h].every(isNumber)) {
      throw new Error('Invalid atlas frame')
    }
  }

  return { image: index.image, tileSize: index.tileSize, frames: index.frames }
}

export interface AtlasLoaders {
  fetchJson(url: string): Promise<unknown>
  loadImage(url: string): Promise<CanvasImageSource>
}

export const browserLoaders: AtlasLoaders = {
  fetchJson: async (url) => (await fetch(url)).json(),
  loadImage: (url) =>
    new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`Cannot load ${url}`))
      image.src = url
    })
}

// Loads the atlas next to its index. A map without sprites still works on the colour fallback, so a failure gives null
export async function loadAtlas(indexUrl: string, loaders: AtlasLoaders = browserLoaders): Promise<Atlas | null> {
  try {
    const index = parseAtlasIndex(await loaders.fetchJson(indexUrl))
    const image = await loaders.loadImage(new URL(index.image, new URL(indexUrl, 'http://atlas.local')).pathname)

    return { image, tileSize: index.tileSize, frame: (name) => index.frames[name] }
  } catch {
    return null
  }
}
