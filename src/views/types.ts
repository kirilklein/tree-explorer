import type { Camera, Mesh, Object3D, Vector3 } from 'three'
import type { Pose, Vec3 } from '../scene/camera'

/*
 * A deep view is one folder, src/views/<name>/, whose index.ts default-exports a View.
 * The shell hides the tree, adds `group` to the scene (same lights as the tree) and calls
 * `update` every frame. Steps are 0-based here; the URL shows them 1-based.
 * On a step change the shell flies the camera to `poses[step]`; the view animates its own
 * objects toward the new step inside `update`. On leave the shell removes `group` and
 * calls `dispose`, which must free every geometry, material and texture the view made.
 * The scene keeps the tree's fog (starts 38 units away), so keep the view within ~30 units
 * of the origin and keep each pose's camera distance inside `distance`.
 * An anchored view is built inside the tree's own space instead: the shell keeps the tree and
 * soil visible, passes the view its site, and zooms by ratio between the poses.
 */

export interface Site {
  tip: Vector3
  direction: Vector3
  radius: number
  stone: Mesh
}

export interface Step {
  title: string
  text: string[]
}

export interface Label {
  text: string
  /** A world position, or an object to follow as it moves. */
  at: Vec3 | Object3D
  /** Steps that show the label; all steps when omitted. */
  steps?: number[]
}

export interface ViewInstance {
  group: Object3D
  /** One camera pose per step. */
  poses: Pose[]
  labels?: Label[]
  /** CSS colour behind the view; the sky gradient when omitted. */
  background?: string
  /** Orbit zoom limits [min, max]; [1, 20] when omitted. */
  distance?: [number, number]
  update(dt: number, step: number, camera: Camera): void
  dispose(): void
}

export interface View {
  steps: Step[]
  anchored?: boolean
  create(site: Site): ViewInstance
}
