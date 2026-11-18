import { Matrix4, Quaternion, Vector3 } from 'three'

export interface Segment {
  start: Vector3
  end: Vector3
  startRadius: number
  endRadius: number
  depth: number
  startSway: number
  endSway: number
}

export interface Leaf {
  position: Vector3
  quaternion: Quaternion
  scale: number
  sway: number
  /** The point on its twig that the leaf's stalk grows from. */
  twig: Vector3
}

export interface Tree {
  branches: Segment[]
  roots: Segment[]
  /** Leaf stalks and short leafy spurs: too fine to count as branches. */
  twigs: Segment[]
  leaves: Leaf[]
}

export const MAX_LEAVES = 3000
export const SOIL_HALF_SIZE = 7
export const SOIL_DEPTH = 3.6

const MAX_DEPTH = 4
/** The depth that marks a leaf stalk among the twigs. */
export const STALK_DEPTH = MAX_DEPTH + 2
/** The longest leaf stalk. */
export const STALK = 0.14
/** Leaves grow straight from a twig only where it is thinner than this. */
const THIN = 0.03
const LENGTHS = [3.4, 3.0, 1.9, 1.25, 0.8]
const SPREAD = [0, 0.75, 0.6, 0.65, 0.6]
const TROPISM = [0.04, 0.03, 0.05, 0.02, -0.05]
const CHILDREN = [5, 3, 3, 3, 0]
const UP = new Vector3(0, 1, 0)
/** The trunk's radius where it meets its roots, just below the ground. */
const FLARE = 0.78

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateTree(seed = 7): Tree {
  const rand = mulberry32(seed)
  const range = (min: number, max: number) => min + (max - min) * rand()
  const branches: Segment[] = []
  const roots: Segment[] = []

  const jitter = (dir: Vector3, amount: number) =>
    dir.add(new Vector3(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(amount)).normalize()

  const turn = (dir: Vector3, angle: number, azimuth: number) => {
    const side = Math.abs(dir.y) < 0.99 ? new Vector3().crossVectors(dir, UP).normalize() : new Vector3(1, 0, 0)
    return dir.clone().applyAxisAngle(side.applyAxisAngle(dir, azimuth), angle)
  }

  function grow(start: Vector3, dir: Vector3, length: number, radius: number, depth: number, sway: number) {
    const steps = depth === 0 ? 4 : 3
    const tipRadius = radius * (depth === MAX_DEPTH ? 0.35 : 0.7)
    let p = start
    let d = dir.clone()
    let s = sway
    const shoots: [Vector3, Vector3, number][] = []
    for (let i = 0; i < steps; i++) {
      jitter(d, depth === 0 ? 0.06 : 0.2)
      d.y += TROPISM[depth]
      d.normalize()
      const end = p.clone().addScaledVector(d, length / steps)
      const nextSway = s + (length / steps) * depth
      branches.push({
        start: p,
        end,
        startRadius: radius + (tipRadius - radius) * (i / steps),
        endRadius: radius + (tipRadius - radius) * ((i + 1) / steps),
        depth,
        startSway: s,
        endSway: nextSway,
      })
      if (depth >= 2 && depth < MAX_DEPTH && i < steps - 1 && rand() < 0.45) {
        const side = turn(d, range(0.7, 1.1), range(0, Math.PI * 2))
        side.y += 0.2
        shoots.push([end, side.normalize(), nextSway])
      }
      p = end
      s = nextSway
    }
    for (const [at, side, atSway] of shoots) {
      grow(at, side, LENGTHS[depth + 1] * range(0.8, 1), tipRadius * 0.8, depth + 1, atSway)
    }
    const count = CHILDREN[depth]
    const offset = range(0, Math.PI * 2)
    for (let j = 0; j < count; j++) {
      const azimuth = offset + (j / count) * Math.PI * 2 + range(-0.4, 0.4)
      const angle = depth === 0 ? (j === 0 ? range(0.1, 0.25) : range(0.65, 1.0)) : SPREAD[depth + 1] * range(0.7, 1.2)
      const child = turn(d, angle, azimuth)
      child.y += 0.1
      const childLength = LENGTHS[depth + 1] * range(0.8, 1.1)
      const fork = depth === 0 ? p.clone().addScaledVector(d, -0.5) : p
      grow(fork, child.normalize(), childLength, tipRadius * (depth > 0 ? 0.75 : j === 0 ? 0.95 : 0.65), depth + 1, s)
    }
  }

  function growRoot(start: Vector3, dir: Vector3, length: number, radius: number, depth: number) {
    const steps = depth < 3 ? 7 : 4
    const tipRadius = radius * 0.3
    let p = start
    let d = dir.clone()
    const limit = SOIL_HALF_SIZE - 0.6
    const open = start.x > 0 && start.z > 0
    const shoots: [Vector3, Vector3, number][] = []
    for (let i = 0; i < steps; i++) {
      jitter(d, 1 / steps)
      d.y -= (0.1 * (depth + 1)) / steps
      d.normalize()
      const end = p.clone().addScaledVector(d, length / steps)
      end.set(
        Math.max(-limit, Math.min(limit, end.x)),
        Math.max(-SOIL_DEPTH + 0.7, Math.min(-0.2, end.y)),
        Math.max(-limit, Math.min(limit, end.z)),
      )
      const r1 = radius + (tipRadius - radius) * ((i + 1) / steps)
      // A root that starts in the soil stays there: it does not come out of a wall of the cutaway.
      if (!open && end.x > -r1 && end.z > -r1) end[end.x < end.z ? 'x' : 'z'] = -r1 - 0.02
      roots.push({
        start: p,
        end,
        startRadius: radius + (tipRadius - radius) * (i / steps),
        endRadius: r1,
        depth,
        startSway: 0,
        endSway: 0,
      })
      if (depth < 4 && i >= 1 && rand() < (steps === 4 ? 0.65 : 0.37)) {
        const side = turn(d, range(0.6, 1.1), range(0, Math.PI * 2))
        side.y = Math.min(side.y, -0.05)
        shoots.push([end, side.normalize(), r1])
      }
      p = end
    }
    for (const [at, side, r] of shoots) growRoot(at, side, length * range(0.45, 0.6), r * 0.6, depth + 1)
  }

  grow(new Vector3(0, -0.5, 0), UP.clone(), LENGTHS[0], 0.5, 0, 0)

  const leaves: Leaf[] = []
  const twigs: Segment[] = []
  let around = 0

  /** One leaf on a stalk, at the share `t` along the twig; `along` leans it towards the twig's tip. */
  function leafOn(twig: Segment, t: number, along: number) {
    if (leaves.length >= MAX_LEAVES) return
    const axis = twig.end.clone().sub(twig.start).normalize()
    around += 2.39996
    const out = turn(axis, Math.PI / 2, around)
    const sway = twig.startSway + (twig.endSway - twig.startSway) * t
    const node = twig.start.clone().lerp(twig.end, t).addScaledVector(out, twig.startRadius + (twig.endRadius - twig.startRadius) * t)
    const dir = jitter(out.multiplyScalar(1 - along).addScaledVector(axis, along).add(new Vector3(0, 0.2, 0)), 0.2)
    const position = node.clone().addScaledVector(dir, range(0.08, STALK))
    // The leaf mesh has its upper side on local -Z.
    const face = UP.clone().addScaledVector(dir, -dir.y)
    if (face.lengthSq() < 1e-4) face.set(1, 0, 0).addScaledVector(dir, -dir.x)
    face.normalize().applyAxisAngle(dir, range(-0.5, 0.5)).negate()
    const quaternion = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(dir, face), dir, face))
    leaves.push({ position, quaternion, scale: range(0.4, 0.58), sway, twig: node })
    twigs.push({ start: node, end: position, startRadius: 0.0035, endRadius: 0.002, depth: STALK_DEPTH, startSway: sway, endSway: sway })
  }

  function spurOn(twig: Segment) {
    const t = range(0.25, 0.9)
    const axis = twig.end.clone().sub(twig.start).normalize()
    const dir = turn(axis, range(0.6, 1.0), range(0, Math.PI * 2))
    dir.y += 0.15
    const start = twig.start.clone().lerp(twig.end, t)
    const length = range(0.25, 0.4)
    const sway = twig.startSway + (twig.endSway - twig.startSway) * t
    const spur: Segment = {
      start,
      end: start.clone().addScaledVector(dir.normalize(), length),
      startRadius: 0.007,
      endRadius: 0.003,
      depth: MAX_DEPTH + 1,
      startSway: sway,
      endSway: sway + length * MAX_DEPTH,
    }
    twigs.push(spur)
    for (const at of [0.35, 0.65, 0.95]) leafOn(spur, at, 0.45)
    leafOn(spur, 1, 0.95)
  }

  const starts = new Set(branches.map((b) => b.start))
  for (const twig of branches.filter((b) => b.depth === MAX_DEPTH)) {
    if (twig.endRadius < THIN) for (const at of [0.3, 0.8]) leafOn(twig, at, 0.45)
    if (!starts.has(twig.end)) leafOn(twig, 1, 0.95)
    if (rand() < 0.7) spurOn(twig)
  }

  // The trunk widens into a flare at the ground and narrows again below it; the main roots leave from that stump.
  const base = branches[0]
  base.startRadius = FLARE
  const stump: Segment = { start: base.start, end: new Vector3(0, -1.1, 0), startRadius: FLARE, endRadius: 0.3, depth: 0, startSway: 0, endSway: 0 }
  roots.push(stump)
  const rootCount = 9
  const rootOffset = range(0, Math.PI * 2)
  for (let j = 0; j < rootCount; j++) {
    const azimuth = rootOffset + (j / rootCount) * Math.PI * 2 + range(-0.25, 0.25)
    const elevation = range(0.15, 0.4)
    const out = new Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
    const dir = out.clone().multiplyScalar(Math.cos(elevation)).setY(-Math.sin(elevation))
    const radius = range(0.17, 0.26)
    const y = range(-0.75, -0.55)
    const flare = stump.startRadius + ((stump.endRadius - stump.startRadius) * (stump.start.y - y)) / (stump.start.y - stump.end.y)
    growRoot(out.multiplyScalar(flare - radius).setY(y), dir, range(3.6, 4.6), radius, 0)
  }
  growRoot(stump.end, new Vector3(0, -1, 0), 1.8, 0.24, 1)

  return { branches, roots, twigs, leaves }
}

export function chains(segments: Segment[]): Segment[][] {
  const result: Segment[][] = []
  for (const seg of segments) {
    const last = result.at(-1)?.at(-1)
    if (last && last.end === seg.start && last.depth === seg.depth) result.at(-1)!.push(seg)
    else result.push([seg])
  }
  return result
}
