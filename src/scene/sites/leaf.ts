import { Line3, Vector3 } from 'three'
import { OVERVIEW } from '../camera'
import type { Shot } from '../shot'
import type { Tree } from '../tree'

const DISTANCE = 2.2

export function leafSite(tree: Tree) {
  const centers = tree.leaves.map((l) => new Vector3(0, 0.5 * l.scale, 0).applyQuaternion(l.quaternion).add(l.position))
  const crown = centers.reduce((sum, c) => sum.add(c), new Vector3()).divideScalar(centers.length)
  const eye = new Vector3(...OVERVIEW.position)
  const toward = eye.clone().sub(crown).setY(0).normalize()
  const outward = (i: number) => centers[i].clone().sub(crown).dot(toward)
  const candidates = centers
    .map((_, i) => i)
    .filter((i) => Math.abs(centers[i].y - crown.y) < 2)
    .sort((a, b) => outward(b) - outward(a))
    .slice(0, 120)

  const clearance = (i: number) => {
    const approach = eye.clone().sub(centers[i]).normalize()
    const path = new Line3(centers[i].clone().addScaledVector(approach, 0.35), centers[i].clone().addScaledVector(approach, 4))
    const near = new Vector3()
    let least = Infinity
    centers.forEach((c, j) => {
      if (j !== i && c.distanceTo(centers[i]) < 5) least = Math.min(least, path.closestPointToPoint(c, true, near).distanceTo(c))
    })
    for (const b of tree.branches) {
      if (b.start.distanceTo(centers[i]) > 6) continue
      for (let k = 0; k <= 8; k++) {
        const p = path.at(k / 8, new Vector3())
        least = Math.min(least, new Line3(b.start, b.end).closestPointToPoint(p, true, near).distanceTo(p) - b.startRadius)
      }
    }
    return least
  }
  const facing = (i: number) =>
    Math.abs(new Vector3(0, 0, 1).applyQuaternion(tree.leaves[i].quaternion).dot(eye.clone().sub(centers[i]).normalize()))
  const scores = candidates.map((i) => Math.min(clearance(i), 0.6) + 0.3 * facing(i))
  const index = candidates[scores.indexOf(Math.max(...scores))]
  const leaf = tree.leaves[index]
  const center = centers[index]
  const approach = eye.clone().sub(center).normalize()
  const shot: Shot = { arrival: { position: center.clone().addScaledVector(approach, DISTANCE), target: center.clone() } }
  return {
    index,
    position: leaf.position,
    quaternion: leaf.quaternion,
    scale: leaf.scale,
    center,
    normal: new Vector3(0, 0, 1).applyQuaternion(leaf.quaternion),
    label: new Vector3(0, leaf.scale, 0).applyQuaternion(leaf.quaternion).add(leaf.position),
    shot,
  }
}
