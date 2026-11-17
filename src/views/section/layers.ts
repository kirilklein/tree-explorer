import { mulberry32 } from '../../scene/tree'

export const CELL = 0.009

const OUTER = [
  { name: 'Outer bark', cells: 3 },
  { name: 'Phloem', cells: 3 },
  { name: 'Cambium', cells: 1 },
  { name: 'Sapwood', cells: 6 },
]

export interface Layer {
  name: string
  inner: number
  outer: number
}

export function layersOf(radius: number): Layer[] {
  let outer = radius
  const layers = OUTER.map(({ name, cells }) => {
    const layer = { name, inner: outer - cells * CELL, outer }
    outer = layer.inner
    return layer
  })
  return [...layers, { name: 'Heartwood', inner: 0, outer }]
}

export const layerNamed = (layers: Layer[], name: string) => layers.find((l) => l.name === name)!

export function ringsOf(radius: number) {
  const sapwood = layerNamed(layersOf(radius), 'Sapwood')
  const rand = mulberry32(4)
  const widths = Array.from({ length: 11 }, () => 0.7 + 0.6 * rand())
  const total = widths.reduce((sum, w) => sum + w, 0)
  let r = 0
  const bounds = [0, ...widths.map((w) => (r += (w / total) * sapwood.inner))]
  bounds[bounds.length - 1] = sapwood.inner
  return [...bounds, (sapwood.inner + sapwood.outer) / 2, sapwood.outer]
}
