import { Line3, Matrix4, Triangle, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { nearFor, ratioZoom } from '../../scene/camera'
import type { ShotPose } from '../../scene/shot'
import { SITES, TREE as tree } from '../../scene/sites'
import { createTreeMeshes } from '../../scene/treeMesh'
import { BLOCK, C, NOTCH } from './frame'
import { CELL, CHLOROPLAST, DISTANCES, leafPlan, STACK } from './poses'

const leaf = SITES.leaf
const { geometry } = createTreeMeshes(tree, new Set()).leaves
const plan = leafPlan(leaf, geometry)
const poses: ShotPose[] = [leaf.shot.arrival, ...plan.poses]
const distance = (p: ShotPose) => p.position.distanceTo(p.target)

const index = geometry.getIndex()!
const position = geometry.getAttribute('position')
const triangles = tree.leaves.map((l) => {
  const m = new Matrix4().compose(l.position, l.quaternion, new Vector3().setScalar(l.scale))
  const corner = (k: number) => new Vector3().fromBufferAttribute(position, index.getX(k)).applyMatrix4(m)
  return Array.from({ length: index.count / 3 }, (_, k) => new Triangle(corner(3 * k), corner(3 * k + 1), corner(3 * k + 2)))
})
const centers = tree.leaves.map((l) => l.position)

function leafClearance(p: Vector3, which: (i: number) => boolean) {
  const q = new Vector3()
  let least = Infinity
  centers.forEach((c, i) => {
    if (!which(i) || c.distanceTo(p) > 0.8) return
    for (const t of triangles[i]) least = Math.min(least, t.closestPointToPoint(p, q).distanceTo(p))
  })
  return least
}

const woodClearance = (p: Vector3) =>
  Math.min(
    ...tree.branches.map((s) => {
      const line = new Line3(s.start, s.end)
      const t = line.closestPointToPointParameter(p, true)
      return line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t)
    }),
  )

const toSection = plan.rest.clone().invert()
function tissueClearance(world: Vector3) {
  const p = world.clone().applyMatrix4(toSection)
  const box = (min: Vector3, max: Vector3) => new Vector3().copy(p).clamp(min, max).distanceTo(p)
  const pad = 0.7 * C
  const block = box(new Vector3(-BLOCK.half - pad, -3 * C - pad, -BLOCK.back - pad), new Vector3(BLOCK.half + pad, 3 * C + pad, NOTCH.depth + pad))
  const insideNotch = Math.abs(p.x) < NOTCH.half - pad && p.z > pad && Math.abs(p.y) < 3 * C
  const { R } = plan.axes
  const parts = Object.values(STACK).map((row) => {
    const mid = CELL.clone().add(plan.slot(row))
    const line = new Line3(mid.clone().addScaledVector(R, -1.2 * C), mid.clone().addScaledVector(R, 1.2 * C))
    return line.closestPointToPoint(p, true, new Vector3()).distanceTo(p) - 0.5 * C
  })
  const chloroplast = p.distanceTo(plan.chloroplast) - 0.17 * C
  return Math.min(insideNotch ? Infinity : block, ...parts, chloroplast)
}

describe('the section frame', () => {
  const [x, y, z] = [new Vector3(), new Vector3(), new Vector3()]
  plan.rest.extractBasis(x, y, z)

  it('is a rigid frame lying in the featured leaf blade', () => {
    for (const axis of [x, y, z]) expect(axis.length()).toBeCloseTo(1, 9)
    expect(x.dot(y)).toBeCloseTo(0, 9)
    expect(y.dot(z)).toBeCloseTo(0, 9)
    const origin = new Vector3().setFromMatrixPosition(plan.rest)
    expect(leafClearance(origin, (i) => i === leaf.index)).toBeLessThan(1e-6)
    expect(Math.abs(y.dot(leaf.normal))).toBeGreaterThan(0.9)
  })

  it('keeps the featured cell and chloroplast inside the leaf thickness', () => {
    expect(Math.abs(CELL.x)).toBeLessThan(NOTCH.half)
    expect(CELL.z).toBeLessThan(0)
    expect(CHLOROPLAST.length()).toBeLessThan(0.42 * C)
  })
})

describe('the poses', () => {
  it('hit the planned distances', () => {
    plan.poses.forEach((p, i) => expect(distance(p)).toBeCloseTo(DISTANCES[i], 9))
  })

  it('push in by ratio at every step, about 10,000x in all', () => {
    poses.slice(1).forEach((p, i) => expect(distance(p) / distance(poses[i])).toBeLessThan(0.5))
    expect(distance(poses[0]) / distance(poses.at(-1)!)).toBeGreaterThan(5000)
  })
})

describe('every descent move', () => {
  const moves: [ShotPose, ShotPose, number][] = []
  poses.slice(1).forEach((to, i) => moves.push([poses[i], to, i], [to, poses[i], i]))

  it.each(moves.map((m, i) => [i, m] as const))('move %i stays clear of leaves, wood and cells', (_, [from, to, i]) => {
    for (let k = 0; k <= 200; k++) {
      const { position, target } = ratioZoom(from, to, k / 200)
      const d = position.distanceTo(target)
      const margin = nearFor(d)
      expect(margin).toBeLessThan(d)
      expect(leafClearance(position, () => true)).toBeGreaterThan(margin)
      expect(woodClearance(position)).toBeGreaterThan(margin)
      if (i >= 1) expect(tissueClearance(position)).toBeGreaterThan(margin)
    }
  })
})
