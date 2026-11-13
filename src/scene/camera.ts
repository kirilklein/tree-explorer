import { type PerspectiveCamera, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export type Vec3 = [number, number, number]

export interface Pose {
  position: Vec3
  target: Vec3
}

export interface Inset {
  left: number
  bottom: number
}

const FLIGHT_SECONDS = 1.6
const MIN_HEIGHT = -2.2

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function createCameraRig(camera: PerspectiveCamera, dom: HTMLElement, start: Pose) {
  camera.position.set(...start.position)
  const controls = new OrbitControls(camera, dom)
  controls.target.set(...start.target)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 2
  controls.maxDistance = 34
  controls.maxPolarAngle = Math.PI * 0.6

  const inset: Inset = { left: 0, bottom: 0 }
  let insetGoal: Inset = { left: 0, bottom: 0 }
  let flight: { fromPosition: Vector3; fromTarget: Vector3; to: Pose; elapsed: number } | null = null

  function flyTo(pose: Pose) {
    flight = { fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), to: pose, elapsed: 0 }
    controls.enabled = false
  }

  function update(dt: number, width: number, height: number) {
    if (flight) {
      flight.elapsed += dt
      const t = ease(Math.min(1, flight.elapsed / FLIGHT_SECONDS))
      camera.position.lerpVectors(flight.fromPosition, new Vector3(...flight.to.position), t)
      controls.target.lerpVectors(flight.fromTarget, new Vector3(...flight.to.target), t)
      if (t === 1) {
        flight = null
        controls.enabled = true
      }
    }
    controls.update()
    camera.position.y = Math.max(MIN_HEIGHT, camera.position.y)

    const k = Math.min(1, dt * 4)
    inset.left += (insetGoal.left - inset.left) * k
    inset.bottom += (insetGoal.bottom - inset.bottom) * k
    camera.setViewOffset(width, height, -inset.left / 2, inset.bottom / 2, width, height)
  }

  return {
    flyTo,
    update,
    setInset: (next: Inset) => (insetGoal = next),
    dispose: () => controls.dispose(),
  }
}
