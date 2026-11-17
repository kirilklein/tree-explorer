import { DoubleSide, Line3, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { nearFor, ratioZoom } from '../../scene/camera'
import type { ShotPose } from '../../scene/shot'
import { SITES, TREE } from '../../scene/sites'
import { createTreeMeshes } from '../../scene/treeMesh'
import { createBlock } from './block'
import { createCut, cutPlanes } from './cut'
import { CEILING, FLOOR, surfaceOf, trunkFrame } from './frame'
import { cellsAt, LOOP, PARENCHYMA_ROWS, ROWS, WINDOW_INNER } from './growth'
import { CELL, layersOf } from './layers'
import { sectionPoses } from './poses'
import { createTubes, PITS, SIEVE_HEIGHT, TRACHEIDS } from './tubes'

const { wood } = createTreeMeshes(TREE, new Set(SITES.root.featured.segments))
wood.material.side = DoubleSide
const frame = trunkFrame(SITES.trunk)
const surface = surfaceOf(wood.geometry, frame)
const radius = surface(frame.at(FLOOR), frame.n)
const poses = sectionPoses(frame, radius)
const ray = new Raycaster()

const radial = (p: Vector3) => {
  const d = p.clone().sub(frame.center)
  const h = d.dot(frame.a)
  return { h, out: d.addScaledVector(frame.a, -h) }
}

describe('the cut', () => {
  const cut = createCut(frame, surface, radius)
  cut.update(1)
  const position = cut.geometry.getAttribute('position')
  const vertices = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i))

  it('stays inside the real trunk and reaches its bark', () => {
    let flush = 0
    for (const v of vertices) {
      const { h, out } = radial(v)
      if (out.length() < radius * 0.8) continue
      const origin = frame.at(h)
      ray.set(origin, out.clone().normalize())
      const bark = ray.intersectObject(wood)[0].distance
      expect(out.length()).toBeLessThanOrEqual(bark + 1e-6)
      if (bark - out.length() < 1e-4) flush++
    }
    expect(flush).toBeGreaterThan(100)
  })

  it('faces each part out of the trunk', () => {
    const normal = cut.geometry.getAttribute('normal')
    const index = cut.geometry.index!
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i))
      b.fromBufferAttribute(position, index.getX(i + 1))
      c.fromBufferAttribute(position, index.getX(i + 2))
      const face = b.sub(a).cross(c.sub(a))
      if (face.length() < 1e-9) continue
      expect(face.dot(new Vector3().fromBufferAttribute(normal, index.getX(i)))).toBeGreaterThan(0)
    }
  })

  it('clips nothing but the trunk', () => {
    const clip = cutPlanes(frame)
    const inside = (p: Vector3) => clip.planes.every((plane) => plane.distanceToPoint(p) < 0)
    expect(inside(frame.point(0, radius * 0.5, 0))).toBe(false)
    clip.update(1)
    expect(inside(frame.point(0, radius * 0.5, 0))).toBe(true)
    const top = Math.max(...[-1, 1].flatMap((side) => [0, 1.3].map((r) => frame.point(side * 0.7, r * radius, CEILING).y)))
    for (const s of TREE.branches.filter((b) => b.depth > 0)) {
      expect(Math.min(s.start.y - s.startRadius, s.end.y - s.endRadius)).toBeGreaterThan(top + 0.2)
    }
    expect(inside(frame.point(0, radius * 1.4, 0))).toBe(false)
    expect(inside(frame.point(0, radius * 0.5, FLOOR - 0.01))).toBe(false)
  })
})

describe('the layers', () => {
  const layers = layersOf(radius)

  it('run from the bark to the centre without gaps', () => {
    expect(layers.map((l) => l.name)).toEqual(['Outer bark', 'Phloem', 'Cambium', 'Sapwood', 'Heartwood'])
    expect(layers[0].outer).toBe(radius)
    expect(layers.at(-1)!.inner).toBe(0)
    layers.slice(1).forEach((l, i) => expect(l.outer).toBe(layers[i].inner))
    for (const l of layers) expect(l.outer).toBeGreaterThan(l.inner)
  })
})

describe('the cells', () => {
  const block = createBlock(frame, surface, radius)
  const { outer } = block

  it('never overlap and keep the cambium between wood and phloem', () => {
    for (let t = 0; t < LOOP * 2; t += 0.05) {
      const cells = cellsAt(t, outer)
      for (let row = 0; row < ROWS; row++) {
        const line = cells.filter((c) => c.row === row).sort((p, q) => p.inner + p.outer - q.inner - q.outer)
        line.slice(1).forEach((c, i) => expect(c.inner).toBeGreaterThanOrEqual(line[i].outer - 1e-9))
        for (const c of line) {
          expect(c.outer).toBeGreaterThanOrEqual(c.inner)
          expect(c.outer).toBeLessThanOrEqual(outer[row] + 1e-9)
          if (c.kind === 'phloem') expect(c.inner).toBeGreaterThanOrEqual(0.5)
          if (c.kind === 'conduit' || c.kind === 'parenchyma') expect(c.outer).toBeLessThanOrEqual(-0.5)
        }
      }
    }
  })

  it('starts with dead water-carrying cells and living parenchyma in the sapwood', () => {
    const cells = cellsAt(0, outer)
    const sapwood = cells.filter((c) => c.inner >= -6.5 && c.outer <= -0.5)
    expect(sapwood.length).toBe(ROWS * 6)
    for (const c of sapwood) expect(c.alive).toBeCloseTo(PARENCHYMA_ROWS.includes(c.row) ? 1 : 0, 6)
    for (const c of cells.filter((c) => c.outer <= -6.5)) expect(c.alive).toBeLessThan(1e-6)
    expect(cells.filter((c) => c.kind === 'phloem' && c.bark < 0.5).length).toBe(ROWS * 3)
    expect(cells.filter((c) => c.kind === 'phloem' && c.bark >= 0.5 && c.outer - c.inner > 0.5).length).toBe(ROWS * 3)
  })

  it('repeats every loop', () => {
    const shape = (t: number) =>
      cellsAt(t, outer)
        .filter((c) => c.outer > WINDOW_INNER)
        .map((c) => [c.row, c.inner, c.outer, c.alive].map((v) => v.toFixed(6)).join())
        .sort()
    expect(shape(LOOP + 2.3)).toEqual(shape(2.3))
  })

  it('sits on the floor inside the bark', () => {
    for (let row = 0; row < ROWS; row++) {
      for (const x of [WINDOW_INNER, outer[row]]) {
        const { h, out } = radial(block.point(x, row))
        expect(h).toBeGreaterThan(FLOOR)
        expect(out.length()).toBeLessThan(surface(frame.at(h), out.clone().normalize()))
      }
    }
  })
})

describe('the raised cells', () => {
  const tubes = createTubes(frame, radius)
  const height = (p: Vector3) => (radial(p).h - FLOOR) / CELL

  it('carry water up, from one tracheid to the next only at a pit', () => {
    for (const path of tubes.waterPaths) {
      path.slice(1).forEach((p, i) => {
        const rise = height(p) - height(path[i])
        expect(rise).toBeGreaterThan(-1e-6)
        if (rise < 1e-6) expect(PITS.some((pit) => Math.abs(height(p) - pit) < 1e-6)).toBe(true)
      })
    }
    expect(Math.max(...PITS)).toBeLessThan(TRACHEIDS[1].height)
    expect(PITS[0]).toBeLessThan(TRACHEIDS[0].height)
  })

  it('carry sugar straight down', () => {
    for (const [from, to] of tubes.sugarPaths) {
      expect(height(to)).toBeLessThan(height(from))
      expect(radial(to).out.distanceTo(radial(from).out)).toBeLessThan(1e-9)
    }
  })

  it('stay in the window and inside the bark', () => {
    const tops = [...tubes.waterPaths, ...tubes.sugarPaths].flat()
    for (const p of [...tops, ...Object.values(tubes.points)]) {
      const { h, out } = radial(p)
      expect(h).toBeLessThan(CEILING)
      expect(out.length()).toBeLessThan(surface(frame.at(h), out.clone().normalize()))
    }
    expect(FLOOR + Math.max(SIEVE_HEIGHT, ...TRACHEIDS.map((t) => t.height)) * CELL).toBeLessThan(CEILING)
  })
})

const trunkClearance = (p: Vector3) =>
  Math.min(
    ...TREE.branches
      .filter((b) => b.depth === 0)
      .map((s) => {
        const line = new Line3(s.start, s.end)
        const t = line.closestPointToPointParameter(p, true)
        return line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t)
      }),
  )

const windowPlanes = cutPlanes(frame)
windowPlanes.update(1)
const windowClearance = (p: Vector3) => -Math.max(...windowPlanes.planes.slice(0, 4).map((plane) => plane.distanceToPoint(p)))

describe('every descent move', () => {
  const all: ShotPose[] = [SITES.trunk.shot.arrival, ...poses]
  const moves = all.slice(1).flatMap((to, i) => [[all[i], to], [to, all[i]]])

  it('pushes in at every step', () => {
    all.slice(1).forEach((p, i) => {
      expect(p.position.distanceTo(p.target)).toBeLessThan(all[i].position.distanceTo(all[i].target))
    })
  })

  it.each(moves.map((m, i) => [i, m] as const))('move %i stays outside the trunk or in its window', (_, [from, to]) => {
    for (let i = 0; i <= 300; i++) {
      const { position, target } = ratioZoom(from, to, i / 300)
      const distance = position.distanceTo(target)
      const margin = nearFor(distance)
      expect(margin).toBeLessThan(distance)
      expect(Math.max(trunkClearance(position), windowClearance(position))).toBeGreaterThan(margin)
    }
  })
})
