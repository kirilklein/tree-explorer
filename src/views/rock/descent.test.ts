import { Line3, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { nearFor, ratioZoom } from '../../scene/camera'
import { createGround } from '../../scene/ground'
import { planShot, type ShotPose, wallsAt } from '../../scene/shot'
import { featuredRoot, generateTree, rootTip, SOIL_DEPTH, SOIL_HALF_SIZE } from '../../scene/tree'
import type { Site } from '../types'
import { createHyphae } from './hyphae'
import { rockPoses } from './poses'

const tree = generateTree()
const featured = featuredRoot(tree.roots)
const plan = planShot(featured)
const { stone } = createGround(plan.wall)
const site: Site = { ...rootTip(featured), stone }
const fungus = createHyphae(site)
const steps = rockPoses(site, fungus.featured, fungus.contact, fungus.normal)
const closeUp: ShotPose = { position: plan.position, target: plan.target }

const LAYER_BOTTOMS = [-0.22, -1.1, -2.2, -3.0]
const inSoil = (p: Vector3, walls: number[], margin: number) =>
  p.y < margin &&
  p.y > -SOIL_DEPTH &&
  Math.abs(p.x) < SOIL_HALF_SIZE + margin &&
  Math.abs(p.z) < SOIL_HALF_SIZE + margin &&
  (p.y < -3 + margin ||
    LAYER_BOTTOMS.some(
      (bottom, i) =>
        p.y > bottom - margin &&
        p.y < (LAYER_BOTTOMS[i - 1] ?? 0) + margin &&
        !(p.x > walls[i] + margin && p.z > margin),
    ))

const woodClearance = (p: Vector3) =>
  Math.min(
    ...[...tree.roots, ...tree.branches.filter((b) => b.depth === 0)].map((s) => {
      const line = new Line3(s.start, s.end)
      const t = line.closestPointToPointParameter(p, true)
      return line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t)
    }),
  )

const ray = new Raycaster()
const stoneCenter = stone.position
function stoneClearance(p: Vector3) {
  const toCenter = stoneCenter.clone().sub(p)
  ray.set(p, toCenter.clone().normalize())
  const hit = ray.intersectObject(stone)[0]
  return hit ? hit.distance : -1
}

describe('the featured tip and stone', () => {
  it('ends the featured branch, thin and in the open cutaway', () => {
    const { tip, radius } = rootTip(featured)
    expect(tip).toBe(featured.branch.at(-1))
    expect(radius).toBeLessThan(0.05)
    expect(inSoil(tip, wallsAt(plan, 1, 1), radius)).toBe(false)
  })

  it('sends the featured hypha from the root to the stone', () => {
    expect(fungus.contact.distanceTo(site.tip)).toBeGreaterThan(0.05)
    expect(stoneClearance(fungus.contact.clone().addScaledVector(fungus.normal, 1e-4))).toBeGreaterThanOrEqual(0)
  })
})

describe('ratioZoom', () => {
  const from = steps[0]
  const to = steps[2]
  const distances = Array.from({ length: 101 }, (_, i) => {
    const pose = ratioZoom(from, to, i / 100)
    return pose.position.distanceTo(pose.target)
  })

  it('hits both ends exactly', () => {
    const start = ratioZoom(from, to, 0)
    const end = ratioZoom(from, to, 1)
    expect(start.position.distanceTo(from.position)).toBeLessThan(1e-9)
    expect(end.position.distanceTo(to.position)).toBeLessThan(1e-9)
    expect(end.target.distanceTo(to.target)).toBeLessThan(1e-9)
  })

  it('shrinks the distance steadily by ratio, easing in and out', () => {
    const ratios = distances.slice(1).map((d, i) => d / distances[i])
    for (const r of ratios) expect(r).toBeLessThanOrEqual(1)
    expect(1 - ratios[0]).toBeLessThan((1 - ratios[50]) / 20)
    expect(1 - ratios.at(-1)!).toBeLessThan((1 - ratios[50]) / 20)
  })
})

describe('every descent move', () => {
  const poses = [closeUp, ...steps]
  const moves: [ShotPose, ShotPose, number, number][] = []
  poses.slice(1).forEach((to, i) => {
    const open = i === 0 ? 0 : 1
    moves.push([poses[i], to, open, 1], [to, poses[i], 1, open])
  })

  it.each(moves.map((m, i) => [i, m] as const))('move %i stays outside soil, wood and stone', (_, [from, to, o0, o1]) => {
    for (let i = 0; i <= 300; i++) {
      const t = i / 300
      const { position, target } = ratioZoom(from, to, t)
      const distance = position.distanceTo(target)
      const margin = nearFor(distance)
      expect(margin).toBeLessThan(distance)
      expect(inSoil(position, wallsAt(plan, 1, o0 + (o1 - o0) * t), margin)).toBe(false)
      expect(woodClearance(position)).toBeGreaterThan(margin)
      expect(stoneClearance(position)).toBeGreaterThan(margin)
    }
  })
})
