import { CanvasTexture, Color, MathUtils, SRGBColorSpace } from 'three'
import { type Layer, layersOf, ringsOf } from './layers'

const WIDTH = 4096
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

export function ringTextures(radius: number) {
  const layers = layersOf(radius)
  const rings = ringsOf(radius)
  const cambium = layers.find((l) => l.name === 'Cambium')!
  const paint = (pixel: (rho: number, out: Color) => Color) => {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = 1
    const context = canvas.getContext('2d')!
    const image = context.createImageData(WIDTH, 1)
    const color = new Color()
    for (let x = 0; x < WIDTH; x++) {
      const hex = pixel(((x + 0.5) / WIDTH) * radius, color.setRGB(0, 0, 0)).getHex()
      image.data.set([hex >> 16, (hex >> 8) & 255, hex & 255, 255], x * 4)
    }
    context.putImageData(image, 0, 0)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  }
  return {
    map: paint((rho, out) => colorAt(rho, layers, rings, out)),
    glow: paint((rho, out) => (rho >= cambium.inner && rho < cambium.outer ? out.set('#ffffff') : out)),
  }
}
