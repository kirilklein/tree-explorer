import { Quaternion, Vector3 } from 'three'

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
}

export interface Tree {
  branches: Segment[]
  roots: Segment[]
  leaves: Leaf[]
}

export const MAX_LEAVES = 3000
export const SOIL_HALF_SIZE = 7
export const SOIL_DEPTH = 3.6

const MAX_DEPTH = 4
const LENGTHS = [3.4, 3.0, 1.9, 1.25, 0.8]
const SPREAD = [0, 0.75, 0.6, 0.65, 0.6]
const TROPISM = [0.04, 0.03, 0.05, 0.02, -0.05]
const CHILDREN = [5, 3, 3, 3, 0]
const UP = new Vector3(0, 1, 0)

function mulberry32(seed: number) {
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
  const leafSites: { position: Vector3; dir: Vector3; sway: number }[] = []

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
      if (depth >= MAX_DEPTH - 1) leafSites.push({ position: end, dir: d.clone(), sway: nextSway })
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
    const steps = 4
    const tipRadius = radius * 0.3
    let p = start
    let d = dir.clone()
    const limit = SOIL_HALF_SIZE - 0.6
    const shoots: [Vector3, Vector3, number][] = []
    for (let i = 0; i < steps; i++) {
      jitter(d, 0.25)
      d.y -= 0.025 * (depth + 1)
      d.normalize()
      const end = p.clone().addScaledVector(d, length / steps)
      end.set(
        Math.max(-limit, Math.min(limit, end.x)),
        Math.max(-SOIL_DEPTH + 0.7, Math.min(-0.2, end.y)),
        Math.max(-limit, Math.min(limit, end.z)),
      )
      const r1 = radius + (tipRadius - radius) * ((i + 1) / steps)
      roots.push({
        start: p,
        end,
        startRadius: radius + (tipRadius - radius) * (i / steps),
        endRadius: r1,
        depth,
        startSway: 0,
        endSway: 0,
      })
      if (depth < 4 && i >= 1 && rand() < 0.65) {
        const side = turn(d, range(0.6, 1.1), range(0, Math.PI * 2))
        side.y = Math.min(side.y, -0.05)
        shoots.push([end, side.normalize(), r1])
      }
      p = end
    }
    for (const [at, side, r] of shoots) growRoot(at, side, length * range(0.45, 0.6), r * 0.75, depth + 1)
  }

  grow(new Vector3(0, -0.5, 0), UP.clone(), LENGTHS[0], 0.5, 0, 0)

  const rootCount = 11
  const rootOffset = range(0, Math.PI * 2)
  for (let j = 0; j < rootCount; j++) {
    const azimuth = rootOffset + (j / rootCount) * Math.PI * 2 + range(-0.3, 0.3)
    const elevation = range(0.15, 0.4)
    const dir = new Vector3(Math.cos(azimuth) * Math.cos(elevation), -Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation))
    growRoot(new Vector3(0, -0.35, 0).addScaledVector(dir, 0.2), dir, range(3.6, 4.6), 0.24, 0)
  }
  growRoot(new Vector3(0, -0.4, 0), new Vector3(0, -1, 0), 2.2, 0.26, 1)

  const leaves: Leaf[] = []
  const perSite = (i: number) => Math.floor(((i + 1) * MAX_LEAVES) / leafSites.length) - Math.floor((i * MAX_LEAVES) / leafSites.length)
  leafSites.forEach((site, i) => {
    for (let k = 0; k < perSite(i); k++) {
      const position = site.position
        .clone()
        .add(new Vector3(range(-1, 1), range(-0.6, 1), range(-1, 1)).multiplyScalar(0.5))
      const dir = jitter(site.dir.clone().add(new Vector3(0, 0.4, 0)), 0.9)
      const quaternion = new Quaternion()
        .setFromUnitVectors(UP, dir)
        .multiply(new Quaternion().setFromAxisAngle(UP, range(0, Math.PI * 2)))
      leaves.push({ position, quaternion, scale: range(0.4, 0.58), sway: site.sway })
    }
  })

  return { branches, roots, leaves }
}
