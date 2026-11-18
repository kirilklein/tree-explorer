import { Vector3 } from 'three'
import type { Shot } from '../shot'
import { chains, type Segment, type Tree } from '../tree'

export interface FeaturedRoot {
  stem: Vector3[]
  fork: Vector3
  branch: Vector3[]
  segments: Segment[]
}

const EYE_HEIGHT = -0.35

const pointsOf = (chain: Segment[]) => [chain[0].start, ...chain.map((s) => s.end)]

export function featuredRoot(roots: Segment[]): FeaturedRoot {
  const all = chains(roots)
  let best: (FeaturedRoot & { burial: number }) | null = null
  for (const main of all.filter((c) => c[0].depth === 0)) {
    const start = main[0].start
    if (start.z <= 0 || -start.x > main[0].startRadius) continue
    main.slice(0, -1).forEach((seg, i) => {
      const child = all.find((c) => c[0].start === seg.end)
      const burial = -seg.end.x
      if (!child || seg.end.z <= 0 || burial < seg.endRadius || (best && best.burial <= burial)) return
      const segments = [...main.slice(0, i + 1), ...child]
      best = { stem: pointsOf(main.slice(0, i + 1)), fork: seg.end, branch: pointsOf(child), segments, burial }
    })
  }
  const { stem, fork, branch, segments } = best!
  return { stem, fork, branch, segments }
}

/** The tree without the roots that grow on from the featured tip, so that the tip is a real end. */
export function endAtFeaturedTip(tree: Tree): Tree {
  const beyond = new Set([featuredRoot(tree.roots).segments.at(-1)!.end])
  const roots = tree.roots.filter((segment) => {
    if (!beyond.has(segment.start)) return true
    beyond.add(segment.end)
    return false
  })
  return { ...tree, roots }
}

function rootTip({ segments }: FeaturedRoot) {
  const last = segments.at(-1)!
  return { tip: last.end, direction: last.end.clone().sub(last.start).normalize(), radius: last.endRadius }
}

export function rootSite(tree: Tree) {
  const featured = featuredRoot(tree.roots)
  const { stem, fork, branch } = featured
  const out = new Vector3(fork.x - stem[0].x, 0, fork.z - stem[0].z).normalize()
  const side = new Vector3(out.z, 0, -out.x)
  const shot: Shot = {
    arrival: {
      position: fork.clone().addScaledVector(out, 1.5).addScaledVector(side, 3.06).setY(EYE_HEIGHT),
      target: fork.clone(),
    },
    glide: out.clone().multiplyScalar(-1.2),
    peel: { wall: fork.x - 1.1, deepWall: branch.at(-1)!.x - 0.6 },
  }
  return { featured, ...rootTip(featured), label: stem.at(-2)!.clone(), shot }
}
