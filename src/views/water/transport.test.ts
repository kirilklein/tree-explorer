import { Line3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { nearFor, OVERVIEW } from '../../scene/camera'
import { type ShotPose, shotAt } from '../../scene/shot'
import { TREE as tree } from '../../scene/sites'
import { type Segment, SOIL_DEPTH, SOIL_HALF_SIZE } from '../../scene/tree'
import { createNetwork, newSample, sample } from './paths'
import { transportPoses } from './poses'
import { SUGAR_DEPTH, WATER_DEPTH } from './streams'

const network = createNetwork(tree)
const { poses, crown, roots } = transportPoses(tree, network)
const wood = [...tree.branches, ...tree.roots]

function clearance(p: Vector3, segments: Segment[]) {
  return Math.min(
    ...segments.map((s) => {
      const line = new Line3(s.start, s.end)
      const t = line.closestPointToPointParameter(p, true)
      return line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t)
    }),
  )
}

const inSoil = (p: Vector3, margin: number) =>
  p.y < margin &&
  p.y > -SOIL_DEPTH - margin &&
  Math.abs(p.x) < SOIL_HALF_SIZE + margin &&
  Math.abs(p.z) < SOIL_HALF_SIZE + margin &&
  (p.y < -3 + margin || !(p.x > margin && p.z > margin))

const pairs = [0, 40, 120, 192].flatMap((r) => [0, 100, 218].map((t) => [r % network.rootEnds.length, t % network.twigs.length]))

describe('water paths', () => {
  it.each(pairs)('run inside the wood from root end %i to twig %i', (r, t) => {
    const path = network.path(r, t)
    expect(path.points[0]).toBe(network.rootEnds[r])
    expect(path.points.at(-1)).toBe(network.twigs[t])
    expect(tree.leaves.some((l) => l.position.distanceTo(network.twigs[t]) < 0.8)).toBe(true)
    const at = newSample()
    let last: Vector3 | null = null
    for (let s = path.s[0]; s <= path.s.at(-1)!; s += 0.02) {
      const p = sample(path, s, WATER_DEPTH, 1.3, at).position.clone()
      if (last) expect(p.distanceTo(last)).toBeLessThan(0.1)
      expect(clearance(p, wood)).toBeLessThan(0)
      last = p
    }
  })

  it('rise steadily through the trunk', () => {
    const path = network.path(5, 50)
    const trunk = path.points.filter((p, i) => path.s[i] >= 0 && p.y < network.forkHeight)
    expect(trunk.length).toBeGreaterThan(2)
    trunk.slice(1).forEach((p, i) => expect(p.y).toBeGreaterThan(trunk[i].y))
  })

  it('share the trunk, so files from different roots and twigs line up', () => {
    const a = network.path(3, 10)
    const b = network.path(150, 200)
    for (const s of [0.5, 1, 1.5, 2]) {
      expect(sample(a, s, WATER_DEPTH, 2, newSample()).position.distanceTo(sample(b, s, WATER_DEPTH, 2, newSample()).position)).toBeLessThan(1e-4)
    }
  })

  it('carry sugar nearer the bark than water in the trunk', () => {
    const path = network.path(0, 0)
    const axis = sample(path, 1, 0, 0, newSample()).position
    const water = sample(path, 1, WATER_DEPTH, 0, newSample())
    const sugar = sample(path, 1, SUGAR_DEPTH, 0, newSample())
    expect(sugar.position.distanceTo(axis)).toBeGreaterThan(water.position.distanceTo(axis) + 0.1)
    expect(sugar.position.distanceTo(axis)).toBeLessThan(sugar.radius)
  })
})

describe('the poses', () => {
  it('frame the whole tree, the crown, the trunk, the roots and the whole tree again', () => {
    const [whole, top, trunk, below, end] = poses
    expect(end).toBe(whole)
    expect(whole.position.distanceTo(whole.target)).toBeGreaterThan(15)
    expect(top.target).toBe(crown)
    expect(crown.y).toBeGreaterThan(network.forkHeight + 2)
    expect(trunk.target.x ** 2 + trunk.target.z ** 2).toBeLessThan(0.01)
    expect(trunk.target.y).toBeGreaterThan(0)
    expect(trunk.target.y).toBeLessThan(network.forkHeight)
    expect(below.target).toBe(roots)
    expect(roots.y).toBeLessThan(-0.5)
    for (const p of [top, trunk, below]) expect(p.position.distanceTo(p.target)).toBeLessThan(7)
  })

  const moves: [ShotPose, ShotPose][] = [[{ position: new Vector3(...OVERVIEW.position), target: new Vector3(...OVERVIEW.target) }, poses[0]]]
  poses.slice(1).forEach((to, i) => moves.push([poses[i], to], [to, poses[i]]))

  it.each(moves.map((m, i) => [i, m] as const))('move %i stays clear of soil, wood and leaves', (_, [from, to]) => {
    for (let i = 0; i <= 200; i++) {
      const { position, target } = shotAt({ arrival: to }, from, i / 200)
      const margin = nearFor(position.distanceTo(target)) + 0.2
      expect(inSoil(position, margin)).toBe(false)
      expect(clearance(position, wood)).toBeGreaterThan(margin)
      expect(Math.min(...tree.leaves.map((l) => l.position.distanceTo(position)))).toBeGreaterThan(0.8)
    }
  })
})
