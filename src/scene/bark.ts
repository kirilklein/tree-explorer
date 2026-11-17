import { CanvasTexture, Color, type MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

/** World size of one bark tile, around the wood and along it. */
export const BARK_TILE = { around: 0.45, along: 0.9 }

const WIDTH = 512
const HEIGHT = 1024
const RIDGES = 6

export const hash = (x: number, y: number, seed: number) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Value noise that repeats after `px` cells across and `py` cells down. */
export function noise(u: number, v: number, px: number, py: number, seed: number) {
  const [x, y] = [u * px, v * py]
  const [x0, y0] = [Math.floor(x), Math.floor(y)]
  const [fx, fy] = [x - x0, y - y0]
  const [sx, sy] = [fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)]
  const at = (i: number, j: number) => hash(((x0 + i) % px + px) % px, ((y0 + j) % py + py) % py, seed)
  return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy) + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy
}

const step = (x: number, from: number, to: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** Height of the bark, 0 in a furrow and 1 on a ridge; repeats in both directions. */
export function barkHeight(u: number, v: number) {
  const x = u * RIDGES + 1.7 * (noise(u, v, 3, 5, 1) - 0.5) + 0.7 * (noise(u, v, 6, 11, 2) - 0.5)
  const ridge = 1 - Math.abs(2 * (x - Math.floor(x)) - 1)
  const width = 0.75 + 0.5 * noise(u, v, 4, 7, 6)
  const crack = step(noise(u, v, 5, 44, 3), 0.76, 0.84)
  const grain = 0.82 + 0.18 * noise(u, v, 48, 90, 4)
  return step(ridge * width, 0.1, 0.62) * (1 - 0.6 * crack) * grain
}

function paint(pixel: (u: number, v: number, out: Color) => Color, srgb: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')!
  const image = context.createImageData(WIDTH, HEIGHT)
  const color = new Color()
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const hex = pixel((x + 0.5) / WIDTH, (y + 0.5) / HEIGHT, color).getHex(srgb ? SRGBColorSpace : undefined)
      image.data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], (y * WIDTH + x) * 4)
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  if (srgb) texture.colorSpace = SRGBColorSpace
  return texture
}

export function applyBark(material: MeshStandardMaterial) {
  const furrow = new Color('#35241a')
  const ridge = new Color('#84654e')
  const tint = new Color('#a89480')
  material.map = paint((u, v, out) => {
    const h = barkHeight(u, v)
    return out.copy(furrow).lerp(ridge, h).lerp(tint, 0.45 * h * h * noise(u, v, 7, 12, 5))
  }, true)
  material.bumpMap = paint((u, v, out) => out.setScalar(barkHeight(u, v)), false)
  material.bumpScale = 1.2
  material.color.set('#ffffff')
  material.needsUpdate = true
}
