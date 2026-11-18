import { CanvasTexture, Color, MathUtils, SRGBColorSpace } from 'three'
import { hash, noise } from '../../scene/bark'
import { type Layer, layersOf, ringsOf } from './layers'

const WIDTH = 2048
const ROWS = 512
const WOOD: Record<string, [string, string]> = {
  Heartwood: ['#b57a4c', '#6a3a20'],
  Sapwood: ['#f0dcae', '#c79c62'],
}
const FLAT: Record<string, string> = { 'Outer bark': '#5a3a26', Phloem: '#c59a63', Cambium: '#f6fbd2' }

function colorAt(rho: number, layers: Layer[], rings: number[], out: Color) {
  const layer = layers.find((l) => rho >= l.inner) ?? layers.at(-1)!
  const wood = WOOD[layer.name]
  if (!wood) {
    const grain = layer.name === 'Cambium' ? 0 : 0.04 * Math.sin(rho * 1300)
    return out.set(FLAT[layer.name]).offsetHSL(0, 0, grain)
  }
  const k = rings.findIndex((b) => b > rho) - 1
  const f = (rho - rings[k]) / (rings[k + 1] - rings[k])
  out.set(wood[0]).lerp(new Color(wood[1]), MathUtils.smoothstep(f, 0.55, 0.95))
  return rho < 0.006 ? out.multiplyScalar(0.6) : out
}

/** Round dots scattered over a grid that repeats after `px` cells across and `py` cells down; 1 inside a dot. */
function dots(u: number, t: number, px: number, py: number, seed: number) {
  const [x, y] = [u * px, t * py]
  let best = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const [cx, cy] = [Math.floor(x) + i, Math.floor(y) + j]
      const [wx, wy] = [((cx % px) + px) % px, ((cy % py) + py) % py]
      if (hash(wx, wy, seed) < 0.45) continue
      const d = Math.hypot(x - cx - 0.2 - 0.6 * hash(wx, wy, seed + 1), y - cy - 0.2 - 0.6 * hash(wx, wy, seed + 2))
      best = Math.max(best, 1 - MathUtils.smoothstep(d, 0.2, 0.34))
    }
  }
  return best
}

/** Pores and rays where the cut runs across the wood; fibres and vessel lines where it runs along it. */
function detail(u: number, t: number, across: boolean, wood: boolean, bark: boolean) {
  if (bark) return 0.82 + 0.3 * noise(u, t, 220, across ? 30 : 9, 11)
  if (!wood) return 0.95 + 0.08 * noise(u, t, 300, across ? 40 : 12, 12)
  if (across) {
    const pore = dots(u, t, 150, 20, 13)
    const ray = MathUtils.smoothstep(noise(u, t, 2, 60, 14), 0.74, 0.8)
    return (1 - 0.38 * pore) * (1 + 0.07 * ray) * (0.96 + 0.06 * noise(u, t, 400, 50, 15))
  }
  const vessel = MathUtils.smoothstep(noise(u, t, 170, 3, 16), 0.7, 0.78)
  return (1 - 0.22 * vessel) * (0.9 + 0.14 * noise(u, t, 420, 7, 17))
}

export function ringTextures(radius: number) {
  const layers = layersOf(radius)
  const rings = ringsOf(radius)
  const cambium = layers.find((l) => l.name === 'Cambium')!
  const paint = (rows: number, pixel: (rho: number, u: number, row: number, out: Color) => Color) => {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = rows
    const context = canvas.getContext('2d')!
    const image = context.createImageData(WIDTH, rows)
    const color = new Color()
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const u = (x + 0.5) / WIDTH
        const hex = pixel(u * radius, u, y, color.setRGB(0, 0, 0)).getHex()
        image.data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], (y * WIDTH + x) * 4)
      }
    }
    context.putImageData(image, 0, 0)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }
  const half = ROWS / 2
  return {
    map: paint(ROWS, (rho, u, row, out) => {
      const name = (layers.find((l) => rho >= l.inner) ?? layers.at(-1)!).name
      const across = row >= half
      const shade = detail(u, ((row % half) + 0.5) / half, across, name in WOOD, name === 'Outer bark')
      return colorAt(rho, layers, rings, out).multiplyScalar(name === 'Cambium' ? 1 : shade)
    }),
    glow: paint(1, (rho, _u, _row, out) => (rho >= cambium.inner && rho < cambium.outer ? out.set('#ffffff') : out)),
  }
}
