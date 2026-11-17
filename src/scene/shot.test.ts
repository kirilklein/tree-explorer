import { Line3, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { OVERVIEW } from '../data/stops'
import { advance, planShot, SHOT_SECONDS, type ShotFrame, type ShotPose, shotAt } from './shot'
import { featuredRoot, generateTree, SOIL_DEPTH, SOIL_HALF_SIZE } from './tree'

const tree = generateTree()
const plan = planShot(featuredRoot(tree.roots))
const fork = plan.target
const overview: ShotPose = { position: new Vector3(...OVERVIEW.position), target: new Vector3(...OVERVIEW.target) }
const starts: Record<string, ShotPose> = {
  default: overview,
  offAxis: {
    position: overview.position.clone().applyAxisAngle(new Vector3(0, 1, 0), (2 * Math.PI) / 3).setY(15),
    target: overview.target,
  },
  zoomedIn: {
    position: overview.position.clone().sub(overview.target).setLength(2.5).add(overview.target),
    target: overview.target,
  },
}
const STEPS = 60 * SHOT_SECONDS

const camera = new PerspectiveCamera(38, 16 / 9, 0.1, 200)
function view(frame: ShotFrame) {
  camera.position.copy(frame.position)
  camera.lookAt(frame.target)
  camera.updateMatrixWorld()
  return { screen: fork.clone().project(camera), look: frame.target.clone().sub(frame.position).normalize() }
}

const LAYER_BOTTOMS = [-0.22, -1.1, -2.2, -3.0]
const solid = (p: Vector3, walls: number[]) =>
  p.y < 0.1 &&
  p.y > -SOIL_DEPTH &&
  Math.abs(p.x) < SOIL_HALF_SIZE + 0.1 &&
  Math.abs(p.z) < SOIL_HALF_SIZE + 0.1 &&
  (p.y < -2.9 ||
    LAYER_BOTTOMS.some((bottom, i) => p.y > bottom - 0.1 && p.y < (LAYER_BOTTOMS[i - 1] ?? 0) + 0.1 && !(p.x > walls[i] + 0.1 && p.z > 0.1)))

const clearance = (p: Vector3) =>
  Math.min(
    ...[...tree.roots, ...tree.branches.filter((b) => b.depth === 0)].map((s) => {
      const line = new Line3(s.start, s.end)
      const t = line.closestPointToPointParameter(p, true)
      return line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t)
    }),
  )

describe.each(Object.entries(starts))('roots shot from the %s pose', (_, start) => {
  const frames = Array.from({ length: STEPS + 1 }, (_, i) => shotAt(plan, start, i / STEPS))

  it('starts exactly at the start pose and ends at the arrival', () => {
    expect(frames[0].position.distanceTo(start.position)).toBeLessThan(1e-9)
    expect(frames[0].target.distanceTo(start.target)).toBeLessThan(1e-9)
    for (const wall of frames[0].walls) expect(wall).toBeCloseTo(0, 9)
    expect(frames[STEPS].position.distanceTo(plan.position)).toBeLessThan(1e-9)
    expect(frames[STEPS].target.distanceTo(fork)).toBeLessThan(1e-9)
  })

  it('keeps the fork in frame once the look target reaches it', () => {
    for (const frame of frames.filter((f) => f.target.distanceTo(fork) < 1e-6)) {
      const { screen } = view(frame)
      expect(Math.abs(screen.x)).toBeLessThan(0.8)
      expect(Math.abs(screen.y)).toBeLessThan(0.8)
      expect(screen.z).toBeLessThan(1)
    }
  })

  it('moves without jumps', () => {
    for (let i = 1; i <= STEPS; i++) {
      const [a, b] = [view(frames[i - 1]), view(frames[i])]
      const step = frames[i].position.distanceTo(frames[i - 1].position)
      expect(step / frames[i].position.distanceTo(fork)).toBeLessThan(0.03)
      expect(a.look.angleTo(b.look)).toBeLessThan(0.02)
      if ([a, b].every(({ screen }) => screen.z < 1 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1))
        expect(a.screen.distanceTo(b.screen)).toBeLessThan(0.05)
    }
  })

  it('never enters the trunk, a root or solid soil', () => {
    for (const { position, walls } of frames) {
      expect(solid(position, walls)).toBe(false)
      expect(clearance(position)).toBeGreaterThan(0.3)
    }
  })

  it('returns to the start pose when reversed, also mid-flight', () => {
    for (const turnAt of [1, 0.4]) {
      let p = 0
      while (p < turnAt) p = advance(p, 1, 1 / 60)
      const before = shotAt(plan, start, p)
      const after = shotAt(plan, start, advance(p, -1, 1 / 60))
      expect(after.position.distanceTo(before.position) / before.position.distanceTo(fork)).toBeLessThan(0.03)
      while (p > 0) p = advance(p, -1, 1 / 60)
      expect(shotAt(plan, start, p).position.distanceTo(start.position)).toBeLessThan(1e-9)
    }
  })
})
