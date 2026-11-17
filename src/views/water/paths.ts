import { Line3, Quaternion, Vector3 } from 'three'
import { chains, type Segment, type Tree } from '../../scene/tree'

export interface Path {
  points: Vector3[]
  radii: number[]
  sways: number[]
  normals: Vector3[]
  binormals: Vector3[]
  /** Arc length of each point, 0 at the base of the trunk. */
  s: number[]
}

interface Node {
  point: Vector3
  radius: number
  sway: number
}

interface Link {
  chain: Segment[]
  parent?: Link
  at: number
}

const pointsOf = (chain: Segment[]) => [chain[0].start, ...chain.map((s) => s.end)]

function nodesOf(chain: Segment[]): Node[] {
  return [
    { point: chain[0].start, radius: chain[0].startRadius, sway: chain[0].startSway },
    ...chain.map((s) => ({ point: s.end, radius: s.endRadius, sway: s.endSway })),
  ]
}

function closest(chain: Segment[], p: Vector3) {
  let best = { at: 0, distance: Infinity }
  chain.forEach((seg, i) => {
    const line = new Line3(seg.start, seg.end)
    const t = line.closestPointToPointParameter(p, true)
    const distance = line.at(t, new Vector3()).distanceTo(p)
    if (distance < best.distance) best = { at: i + t, distance }
  })
  return best
}

function linkAll(all: Segment[][], attached: (c: Segment[], parent: Segment[]) => boolean) {
  const links = new Map<Segment[], Link>()
  for (const chain of all) {
    const parents = all.filter((c) => c[0].depth === chain[0].depth - 1 && attached(chain, c))
    const parent = parents
      .map((c) => ({ c, ...closest(c, chain[0].start) }))
      .sort((a, b) => a.distance - b.distance)[0]
    links.set(chain, parent && parent.distance < 1e-6 ? { chain, parent: links.get(parent.c), at: parent.at } : { chain, at: 0 })
  }
  return links
}

/** Nodes from the base of the first chain in the lineage out to the end of `link`. */
function route(link: Link): Node[] {
  const lineage: Link[] = []
  for (let l: Link | undefined = link; l; l = l.parent) lineage.unshift(l)
  const nodes: Node[] = []
  lineage.forEach((l, k) => {
    const own = nodesOf(l.chain)
    const next = lineage[k + 1]
    if (!next) return nodes.push(...own.slice(k ? 1 : 0))
    const i = Math.min(Math.floor(next.at), l.chain.length - 1)
    const seg = l.chain[i]
    nodes.push(...own.slice(k ? 1 : 0, i + 1))
    const fork = seg.start.clone().lerp(seg.end, next.at - i)
    if (fork.distanceTo(nodes.at(-1)!.point) < 1e-6) nodes.pop()
    nodes.push({ point: fork, radius: next.chain[0].startRadius, sway: next.chain[0].startSway })
  })
  return nodes
}

const terminals = (all: Segment[][]) =>
  all.filter((c) => !all.some((o) => o !== c && o[0].start === c.at(-1)!.end))

function frames(points: Vector3[], first: Vector3, firstTangent?: Vector3) {
  const tangents = points.map((_, i) =>
    points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(i - 1, 0)]).normalize(),
  )
  if (firstTangent) tangents[0] = firstTangent
  const normals = [first.clone().projectOnPlane(tangents[0]).normalize()]
  const turn = new Quaternion()
  for (let i = 1; i < points.length; i++) {
    normals.push(normals[i - 1].clone().applyQuaternion(turn.setFromUnitVectors(tangents[i - 1], tangents[i])))
  }
  return normals.map((normal, i) => ({ normal, binormal: new Vector3().crossVectors(tangents[i], normal) }))
}

export function createNetwork(tree: Tree) {
  const branchChains = chains(tree.branches)
  const rootChains = chains(tree.roots)
  const trunk = branchChains.find((c) => c[0].depth === 0)!
  const branchLinks = linkAll(branchChains, () => true)
  const rootLinks = linkAll(rootChains, (c, p) => p.some((s) => s.end === c[0].start))
  const twigs = terminals(branchChains).filter((c) => c[0].depth >= 3)
  const rootEnds = terminals(rootChains)

  const trunkPoints = pointsOf(trunk)
  const crowns = twigs.map((twig) => {
    const nodes = route(branchLinks.get(twig)!)
    const points = nodes.map((n) => n.point)
    const s = [0]
    for (let i = 1; i < points.length; i++) s.push(s[i - 1] + points[i].distanceTo(points[i - 1]))
    return { nodes, s, frames: frames(points, new Vector3(1, 0, 0)) }
  })

  function entryOf(start: Vector3) {
    const { at } = closest(trunk, start)
    const i = Math.floor(at)
    const crown = crowns[0]
    const t = at - i
    const point = trunkPoints[i].clone().lerp(trunkPoints[i + 1], t)
    return {
      node: { point, radius: trunk[i].startRadius + (trunk[i].endRadius - trunk[i].startRadius) * t, sway: 0 },
      s: crown.s[i] + (crown.s[i + 1] - crown.s[i]) * t,
      normal: crown.frames[i].normal.clone().lerp(crown.frames[i + 1].normal, t).normalize(),
      tangent: trunkPoints[i + 1].clone().sub(trunkPoints[i]).normalize(),
    }
  }

  const roots = rootEnds.map((end) => {
    const own = route(rootLinks.get(end)!)
    const entry = entryOf(own[0].point)
    if (own[0].point.distanceTo(entry.node.point) < 0.05) own.shift()
    const nodes = [entry.node, ...own]
    const points = nodes.map((n) => n.point)
    const s = [entry.s]
    for (let i = 1; i < points.length; i++) s.push(s[i - 1] - points[i].distanceTo(points[i - 1]))
    const out = frames(points, entry.normal, entry.tangent.clone().negate())
    return { nodes, s, frames: out.map((f) => ({ ...f, binormal: f.binormal.negate() })), entry }
  })

  function path(root: number, twig: number): Path {
    const r = roots[root]
    const c = crowns[twig]
    const above = c.s.map((_, i) => i).filter((i) => c.s[i] > r.entry.s)
    const nodes = [...r.nodes.slice().reverse(), ...above.map((i) => c.nodes[i])]
    const along = [...r.frames.slice().reverse(), ...above.map((i) => c.frames[i])]
    return {
      points: nodes.map((n) => n.point),
      radii: nodes.map((n) => n.radius),
      sways: nodes.map((n) => n.sway),
      normals: along.map((f) => f.normal),
      binormals: along.map((f) => f.binormal),
      s: [...r.s.slice().reverse(), ...above.map((i) => c.s[i])],
    }
  }

  return {
    path,
    twigs: twigs.map((c) => c.at(-1)!.end),
    rootEnds: rootEnds.map((c) => c.at(-1)!.end),
    /** Where the first branches leave the trunk. */
    forkHeight: Math.min(...branchChains.filter((c) => c[0].depth === 1).map((c) => c[0].start.y)),
  }
}

export type Network = ReturnType<typeof createNetwork>

export interface Sample {
  position: Vector3
  tangent: Vector3
  radius: number
  sway: number
}

const NORMAL = new Vector3()
const BINORMAL = new Vector3()

/** A point at arc length `s`, `depth` of the way from the axis to the bark, at `angle` round the axis. */
export function sample(path: Path, s: number, depth: number, angle: number, out: Sample): Sample {
  const { points, radii, sways, normals, binormals } = path
  let i = 0
  while (i < points.length - 2 && path.s[i + 1] < s) i++
  const span = path.s[i + 1] - path.s[i]
  const t = Math.min(1, Math.max(0, (s - path.s[i]) / span))
  out.tangent.subVectors(points[i + 1], points[i]).normalize()
  out.radius = radii[i] + (radii[i + 1] - radii[i]) * t
  out.sway = sways[i] + (sways[i + 1] - sways[i]) * t
  const normal = NORMAL.copy(normals[i]).lerp(normals[i + 1], t).normalize()
  const binormal = BINORMAL.copy(binormals[i]).lerp(binormals[i + 1], t).normalize()
  out.position
    .lerpVectors(points[i], points[i + 1], t)
    .addScaledVector(normal, Math.cos(angle) * depth * out.radius)
    .addScaledVector(binormal, Math.sin(angle) * depth * out.radius)
  return out
}

export const newSample = (): Sample => ({ position: new Vector3(), tangent: new Vector3(), radius: 0, sway: 0 })
