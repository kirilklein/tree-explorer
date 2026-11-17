import { type PerspectiveCamera, Quaternion } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ShotPose } from './shot'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export const OVERVIEW: Pose = { position: [17, 6, 23], target: [0, 2.4, 0] }

export interface Inset {
  left: number
  bottom: number
}

const MIN_HEIGHT = -2.2

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export const nearFor = (distance: number) => Math.min(0.1, distance / 20)

export function ratioZoom(from: ShotPose, to: ShotPose, t: number): ShotPose {
  const e = ease(t)
  const d0 = from.position.distanceTo(from.target)
  const d1 = to.position.distanceTo(to.target)
  const d = d0 * Math.pow(d1 / d0, e)
  const k = Math.abs(d1 - d0) < 1e-9 ? e : (d0 - d) / (d0 - d1)
  const target = from.target.clone().lerp(to.target, k)
  const dir0 = from.position.clone().sub(from.target).normalize()
  const dir1 = to.position.clone().sub(to.target).normalize()
  const turn = new Quaternion().slerp(new Quaternion().setFromUnitVectors(dir0, dir1), e)
  return { position: dir0.applyQuaternion(turn).multiplyScalar(d).add(target), target }
}

export function createCameraRig(camera: PerspectiveCamera, dom: HTMLElement, start: Pose) {
  camera.position.set(...start.position)
  const controls = new OrbitControls(camera, dom)
  controls.target.set(...start.target)
  controls.enableDamping = true
  controls.enablePan = false
  let minHeight = MIN_HEIGHT
  function setLimits(distance: [number, number] | null, maxPolar = distance ? Math.PI : Math.PI * 0.6) {
    ;[controls.minDistance, controls.maxDistance] = distance ?? [2, 34]
    controls.maxPolarAngle = maxPolar
    minHeight = distance ? -Infinity : MIN_HEIGHT
  }
  setLimits(null)

  const inset: Inset = { left: 0, bottom: 0 }
  let insetGoal: Inset = { left: 0, bottom: 0 }
  let held: ShotPose | null = null

  function hold(pose: ShotPose | null) {
    held = pose
    controls.enabled = !pose
  }

  function update(dt: number, width: number, height: number) {
    controls.update()
    if (held) {
      camera.position.copy(held.position)
      controls.target.copy(held.target)
      camera.lookAt(held.target)
    } else camera.position.y = Math.max(minHeight, camera.position.y)

    camera.near = nearFor(camera.position.distanceTo(controls.target))
    const k = Math.min(1, dt * 4)
    inset.left += (insetGoal.left - inset.left) * k
    inset.bottom += (insetGoal.bottom - inset.bottom) * k
    camera.setViewOffset(width, height, -inset.left / 2, inset.bottom / 2, width, height)
  }

  return {
    hold,
    pose: (): ShotPose => ({ position: camera.position.clone(), target: controls.target.clone() }),
    update,
    setInset: (next: Inset) => (insetGoal = next),
    setLimits,
    dispose: () => controls.dispose(),
  }
}
