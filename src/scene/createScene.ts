import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  type Material,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OVERVIEW, type Stop } from '../data/stops'
import type { Site, View, ViewInstance } from '../views/types'
import { createCameraRig, type Pose, ratioZoom } from './camera'
import { createGround } from './ground'
import { advance, planShot, type ShotPose, shotAt, wallsAt } from './shot'
import { featuredRoot, generateTree, rootTip } from './tree'
import { createTreeMeshes } from './treeMesh'
import { windTime } from './wind'

const MOVE_SECONDS = 3

type FrameListener = (camera: PerspectiveCamera, width: number, height: number) => void

export type SceneHandle = ReturnType<typeof createScene>

export function createScene(container: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.fog = new Fog('#dfe9e4', 38, 80)

  scene.add(new HemisphereLight('#cfe6ff', '#8a6f4e', 1.6))
  const sun = new DirectionalLight('#fff3dc', 2.4)
  sun.position.set(9, 16, 7)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.001
  sun.shadow.normalBias = 0.06
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 13, bottom: -9, near: 1, far: 50 })
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)

  const treeData = generateTree()
  const featured = featuredRoot(treeData.roots)
  const plan = planShot(featured)
  const { wood, roots, featuredRoot: featuredMesh, leaves } = createTreeMeshes(treeData, new Set(featured.segments))
  const { ground, setWalls, stone } = createGround(plan.wall)
  const tree = new Group().add(wood, roots, featuredMesh, leaves, ground)
  scene.add(tree)
  const site: Site = { ...rootTip(featured), stone }

  const camera = new PerspectiveCamera(38, 1, 0.1, 200)
  const rig = createCameraRig(camera, renderer.domElement, OVERVIEW)

  const overview: ShotPose = { position: new Vector3(...OVERVIEW.position), target: new Vector3(...OVERVIEW.target) }
  const shot = { start: overview, p: 0, dir: 0, then: null as Pose | null }
  const arrival: ShotPose = { position: plan.position, target: plan.target }
  let open = 0
  let move: { from: ShotPose; to: ShotPose; t: number; open: [number, number]; done?: () => void } | null = null
  let snap = true
  let settled = true
  const settleListeners = new Set<(settled: boolean) => void>()

  function notify() {
    const nowSettled = !move && (shot.dir === 0 || (shot.dir > 0 && shot.p > 0.95))
    if (nowSettled === settled) return
    settled = nowSettled
    for (const listener of settleListeners) listener(settled)
  }

  function showStop(stop: Stop | null) {
    const instant = snap
    snap = false
    if (stop && !stop.pose) {
      if (shot.p === 0) shot.start = instant ? overview : rig.pose()
      if (shot.p < 1 || instant) Object.assign(shot, { dir: 1, then: null, p: instant ? 1 : shot.p })
    } else if (shot.p > 0) {
      move?.done?.()
      move = null
      open = 0
      Object.assign(shot, { dir: -1, then: stop?.pose ?? null, p: instant ? 0 : shot.p })
    } else rig.flyTo(stop?.pose ?? OVERVIEW)
    notify()
  }

  const listeners = new Set<FrameListener>()
  let width = 1
  let height = 1
  const resize = () => {
    width = container.clientWidth
    height = container.clientHeight
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(19)) / Math.min(camera.aspect, 1)))
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  let view: { instance: ViewInstance; step: number; anchored: boolean } | null = null

  function drop() {
    if (!view) return
    scene.remove(view.instance.group)
    view.instance.dispose()
    view = null
  }

  function moveTo(to: ShotPose, toOpen: number, instant: boolean, done?: () => void) {
    rig.hold(null)
    move = { from: rig.pose(), to, t: instant ? 1 : 0, open: [open, toOpen], done }
    notify()
  }

  function showView(next: View | null) {
    if (view?.anchored && !next && shot.p === 1) {
      moveTo(arrival, 0, false, drop)
      return null
    }
    drop()
    if (next && !next.anchored) {
      snap = true
      shot.dir = 0
      rig.hold(null)
    }
    tree.visible = !next || !!next.anchored
    scene.background = null
    rig.setLimits(null)
    if (!next) return null
    const instance = next.create(site)
    scene.add(instance.group)
    if (instance.background) scene.background = new Color(instance.background)
    if (!next.anchored) rig.setLimits(instance.distance ?? [1, 20])
    view = { instance, step: 0, anchored: !!next.anchored }
    return instance
  }

  function showStep(step: number) {
    if (!view) return
    view.step = step
    const pose = view.instance.poses[step]
    if (!view.anchored) return rig.flyTo(pose)
    const instant = snap || shot.p < 1 || shot.dir !== 0
    snap = false
    Object.assign(shot, { p: 1, dir: 0 })
    moveTo({ position: new Vector3(...pose.position), target: new Vector3(...pose.target) }, 1, instant)
  }

  const timer = new Timer()
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const dt = Math.min(timer.getDelta(), 0.1)
    if (!view?.anchored && view) view.instance.update(dt, view.step, camera)
    else windTime.value = timer.getElapsed()
    if (move) {
      move.t = Math.min(1, move.t + dt / MOVE_SECONDS)
      const pose = ratioZoom(move.from, move.to, move.t)
      open = move.open[0] + (move.open[1] - move.open[0]) * move.t
      setWalls(wallsAt(plan, shot.p, open))
      rig.hold(pose)
    } else if (shot.dir) {
      shot.p = advance(shot.p, shot.dir, dt)
      const frame = shotAt(plan, shot.start, shot.p)
      setWalls(frame.walls)
      rig.hold(frame)
    }
    rig.update(dt, width, height)
    if (view?.anchored) view.instance.update(dt, view.step, camera)
    if (move?.t === 1) {
      const { to, done } = move
      move = null
      rig.hold(null)
      const d = to.position.distanceTo(to.target)
      if (done) rig.setLimits(null)
      else rig.setLimits([d * 0.5, d * 2], Math.PI / 2)
      done?.()
    }
    if (shot.dir && (shot.p === 0 || shot.p === 1)) {
      shot.dir = 0
      rig.hold(null)
      if (shot.then) rig.flyTo(shot.then)
    }
    notify()
    renderer.render(scene, camera)
    for (const listener of listeners) listener(camera, width, height)
  })

  return {
    rootLabel: featured.stem.at(-2)!.toArray(),
    showStop,
    showView,
    showStep,
    setInset: rig.setInset,
    onSettle(listener: (settled: boolean) => void) {
      settleListeners.add(listener)
      listener(settled)
      return () => void settleListeners.delete(listener)
    },
    onFrame(listener: FrameListener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    dispose() {
      renderer.setAnimationLoop(null)
      showView(null)
      observer.disconnect()
      rig.dispose()
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose()
          ;(object.material as Material).dispose()
          object.customDepthMaterial?.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
