import { MathUtils, Vector3 } from 'three'
import { OVERVIEW } from '../../scene/camera'
import type { ShotPose } from '../../scene/shot'
import type { Tree } from '../../scene/tree'
import type { Network } from './paths'

const UP = new Vector3(0, 1, 0)
const HALF_VIEW = Math.tan(MathUtils.degToRad(19))

const pose = (target: Vector3, from: Vector3, distance: number): ShotPose => ({
  target,
  position: target.clone().addScaledVector(from.clone().normalize(), distance),
})

export function transportPoses(tree: Tree, { twigs, rootEnds, forkHeight }: Network) {
  const out = new Vector3(OVERVIEW.position[0], 0, OVERVIEW.position[2]).normalize()
  const top = Math.max(...tree.leaves.map((l) => l.position.y + l.scale))
  const bottom = Math.min(...tree.roots.map((s) => s.end.y))
  const middle = tree.leaves.reduce((sum, l) => sum + l.position.y, 0) / tree.leaves.length

  const crown = twigs
    .filter((p) => Math.abs(p.y - middle) < 1)
    .reduce((best, p) => (p.dot(out) > best.dot(out) ? p : best))
  const open = rootEnds.filter((p) => p.x > 0.5 && p.z > 0.5)
  const roots = open.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(open.length)
  roots.y = (roots.y - 1) / 2
  const corner = new Vector3(1, 0, 1).normalize()

  const whole = pose(new Vector3(0, (top + bottom) / 2, 0), out.clone().addScaledVector(UP, 0.12), (1.25 * (top - bottom)) / 2 / HALF_VIEW)
  return {
    poses: [
      whole,
      pose(crown, new Vector3().crossVectors(UP, out).addScaledVector(out, 0.9).addScaledVector(UP, 0.05), 4.4),
      pose(new Vector3(0, forkHeight * 0.45, 0), out.clone().addScaledVector(UP, 0.08), 5.6),
      pose(roots, corner.clone().addScaledVector(UP, 0.55), 5.2),
      whole,
    ],
    crown,
    roots,
  }
}
