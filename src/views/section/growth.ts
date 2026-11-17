import { MathUtils } from 'three'

export const LOOP = 12
export const ROWS = 7
export const PARENCHYMA_ROWS = [1, 5]
export const WINDOW_INNER = -11.5
const HEARTWOOD_EDGE = -6.5
const BARK_EDGE = 3.5
const WOOD_AT = [0.8, 5, 7]
const PHLOEM_AT = [3]
const GROW_SECONDS = 1.2
const ROW_DELAY = 0.25

export interface Cell {
  row: number
  inner: number
  outer: number
  kind: 'cambium' | 'phloem' | 'conduit' | 'parenchyma'
  alive: number
  heartwood: number
  bark: number
  id: number
}

const fade = (x: number) => MathUtils.smoothstep(x, 0, 1)

const grown = (t: number, at: number[]) => {
  const loop = Math.floor(t / LOOP)
  const local = t - loop * LOOP
  return loop * at.length + at.reduce((sum, start) => sum + fade((local - start) / GROW_SECONDS), 0)
}

const bornAt = (j: number) => {
  const loop = Math.floor(j / WOOD_AT.length)
  return loop * LOOP + WOOD_AT[j - loop * WOOD_AT.length]
}

export function cellsAt(t: number, outer: number[]): Cell[] {
  const cells: Cell[] = []
  for (let row = 0; row < ROWS; row++) {
    const time = t - row * ROW_DELAY
    const wood = grown(time, WOOD_AT)
    const parenchyma = PARENCHYMA_ROWS.includes(row)
    cells.push({ row, inner: -0.5, outer: 0.5, kind: 'cambium', alive: 1, heartwood: 0, bark: 0, id: row })
    for (let j = Math.ceil(wood) - 1; -0.5 - (wood - j) > WINDOW_INNER - 1; j--) {
      const inner = -0.5 - (wood - j)
      const outerEdge = -0.5 - Math.max(0, wood - j - 1)
      const heartwood = fade(HEARTWOOD_EDGE + 0.5 - (inner + outerEdge) / 2)
      const conduitAlive = 1 - fade((time - bornAt(j) - 0.8) / 2.2)
      const alive = (1 - heartwood) * (parenchyma ? 1 : conduitAlive)
      cells.push({ row, inner, outer: outerEdge, kind: parenchyma ? 'parenchyma' : 'conduit', alive, heartwood, bark: 0, id: 1000 + j * ROWS + row })
    }
    const phloem = grown(time, PHLOEM_AT)
    for (let j = Math.ceil(phloem) - 1; 0.5 + Math.max(0, phloem - j - 1) < outer[row]; j--) {
      const inner = 0.5 + Math.max(0, phloem - j - 1)
      const edge = Math.min(outer[row], 0.5 + (phloem - j))
      const bark = fade((inner + edge) / 2 - BARK_EDGE + 0.5)
      cells.push({ row, inner, outer: edge, kind: 'phloem', alive: 1 - bark, heartwood: 0, bark, id: 100000 + j * ROWS + row })
    }
  }
  return cells
}
