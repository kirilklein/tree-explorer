import type { Camera, Group, InstancedMesh, Mesh, Object3D } from 'three'
import type { Pose, Vec3 } from '../scene/camera'
import type { Sites } from '../scene/sites'
import type { Tree } from '../scene/tree'

/*
 * A view is one folder, src/views/<name>/, whose index.ts default-exports a View. It lives in the
 * tree's own space: the tree stays in the scene and `create` gets the World. Its anchor data
 * belongs in its own site file, src/scene/sites/<site>.ts, a pure function of the tree.
 * The shell adds `group` to the scene and calls `update` every frame. Steps are 0-based here;
 * the URL shows them 1-based. On a step change the shell moves the camera to `poses[step]`:
 * a ratio zoom on a straight line, or round the trunk when `path` is 'around'. The card and
 * labels appear once the camera is still. Leaving flies back to where the view was entered.
 * While shown, a view may change the world's meshes, materials and wind (hide a leaf, set
 * `clippingPlanes` on a material, fade the wood); `dispose` must restore them and free every
 * geometry, material and texture the view made. The shell eases wind back to 1 when a view leaves.
 */

export interface World {
  tree: Tree
  sites: Sites
  wood: Mesh
  roots: Mesh
  featuredRoot: Mesh
  leaves: InstancedMesh
  ground: Group
  stone: Mesh
  /** Scales all wind motion, 0 (calm) to 1; the shell eases towards it. */
  setWind(amount: number): void
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
  /** How the camera moves between poses; 'zoom' when omitted. */
  path?: 'zoom' | 'around'
  /** Opens the soil further behind the featured root while shown, 0 to 1. */
  soil?: number
  update(dt: number, step: number, camera: Camera): void
  dispose(): void
}

export interface View {
  steps: Step[]
  create(world: World): ViewInstance
}
