import {
  ACESFilmicToneMapping,
  DirectionalLight,
  Fog,
  HemisphereLight,
  IcosahedronGeometry,
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
import type { Stop } from '../data/stops'
import type { View, ViewInstance, World } from '../views/types'
import { createCameraRig, OVERVIEW, ratioZoom } from './camera'
import { createGround } from './ground'
import { advance, CUT_LAYERS, SHOT_SECONDS, type Shot, type ShotPose, shotAt, wallsAt } from './shot'
import { SITES, TREE } from './sites'
import { applyBark } from './bark'
import { addDetail, leafTexture, rootTexture, soilTexture, stoneTexture } from './surface'
import { createTreeMeshes } from './treeMesh'
import { windAmount, windTime } from './wind'

const ZOOM_SECONDS = 3
const CLOSED = Array<number>(CUT_LAYERS).fill(0)

type FrameListener = (camera: PerspectiveCamera, width: number, height: number) => void

export type SceneHandle = ReturnType<typeof createScene>

export function createScene(container: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.localClippingEnabled = true
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

  const meshes = createTreeMeshes(TREE, new Set(SITES.root.featured.segments))
  applyBark(meshes.wood.material)
  meshes.leaves.material.map = leafTexture()
  const skin = rootTexture()
  for (const root of [meshes.roots, meshes.featuredRoot]) addDetail(root.material, skin, 'uv', [1, 9, 70])
  const { ground, setWalls, stone } = createGround(SITES.root.shot.peel!.wall)
  const [earth, rock] = [soilTexture(), stoneTexture()]
  const textured = new Set<Material>()
  ground.traverse((object) => {
    if (!(object instanceof Mesh) || textured.has(object.material)) return
    textured.add(object.material)
    if (object.geometry instanceof IcosahedronGeometry) addDetail(object.material, rock, 'blend', [0.6, 0.06, 0.006])
    else addDetail(object.material, earth, 'axis', [2.3, 0.21, 0.023])
  })
  scene.add(meshes.wood, meshes.twigs, meshes.stalks, meshes.roots, meshes.featuredRoot, meshes.leaves, ground)
  let windGoal = 1
  const world: World = {
    tree: TREE,
    sites: SITES,
    ...meshes,
    ground,
    stone,
    setWind: (amount) => (windGoal = MathUtils.clamp(amount, 0, 1)),
  }

  const camera = new PerspectiveCamera(38, 1, 0.1, 200)
  const rig = createCameraRig(camera, renderer.domElement, OVERVIEW)

  const overview: ShotPose = { position: new Vector3(...OVERVIEW.position), target: new Vector3(...OVERVIEW.target) }
  const shot = {
    current: null as Shot | null,
    next: undefined as Shot | null | undefined,
    start: overview,
    p: 0,
    dir: 0,
  }
  let open = 0
  let move: {
    from: ShotPose
    to: ShotPose
    t: number
    around: boolean
    open: [number, number]
    done?: () => void
  } | null = null
  let view: { instance: ViewInstance; stop: Stop | null; step: number; entry: ShotPose } | null = null
  let snap = true
  let settled = true
  const settleListeners = new Set<(settled: boolean) => void>()

  function notify() {
    const nowSettled = !move && (shot.dir === 0 || (shot.dir > 0 && shot.p > 0.95))
    if (nowSettled === settled) return
    settled = nowSettled
    for (const listener of settleListeners) listener(settled)
  }

  function moveTo(to: ShotPose, toOpen: number, instant: boolean, around: boolean, done?: () => void) {
    rig.hold(null)
    move = { from: rig.pose(), to, t: instant ? 1 : 0, around, open: [open, toOpen], done }
    notify()
  }

  function drop() {
    if (!view) return
    scene.remove(view.instance.group)
    view.instance.dispose()
    view = null
  }

  function showStop(stop: Stop | null) {
    const instant = snap
    snap = false
    const next = stop?.shot ?? null
    if (instant) Object.assign(shot, { current: next, next: undefined, start: overview, p: next ? 1 : 0, dir: next ? 1 : 0 })
    else if (next && next === shot.current) {
      if (shot.p < 1) Object.assign(shot, { dir: 1, next: undefined })
    } else if (shot.p > 0) Object.assign(shot, { dir: -1, next })
    else if (next) Object.assign(shot, { current: next, next: undefined, start: rig.pose(), dir: 1 })
    notify()
  }

  function showView(next: View | null, stop: Stop | null = null) {
    if (!next) {
      if (!view) return null
      windGoal = 1
      moveTo(view.entry, 0, false, view.instance.path === 'around', drop)
      return null
    }
    drop()
    const instance = next.create(world)
    scene.add(instance.group)
    view = { instance, stop, step: -1, entry: rig.pose() }
    return instance
  }

  function showStep(step: number) {
    if (!view) return
    const first = view.step < 0
    view.step = step
    const atStop = !view.stop || (shot.current === view.stop.shot && shot.p === 1 && shot.dir === 0)
    const instant = snap || (first && !atStop)
    snap = false
    if (first && view.stop) {
      if (instant) Object.assign(shot, { current: view.stop.shot, next: undefined, start: overview, p: 1, dir: 0 })
      view.entry = view.stop.shot.arrival
    }
    const { position, target } = view.instance.poses[step]
    const to = { position: new Vector3(...position), target: new Vector3(...target) }
    moveTo(to, view.instance.soil ?? 0, instant, view.instance.path === 'around')
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

  const timer = new Timer()
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const dt = Math.min(timer.getDelta(), 0.1)
    windTime.value = timer.getElapsed()
    windAmount.value += (windGoal - windAmount.value) * Math.min(1, dt * 1.5)
    if (move) {
      move.t = Math.min(1, move.t + dt / (move.around ? SHOT_SECONDS : ZOOM_SECONDS))
      open = move.open[0] + (move.open[1] - move.open[0]) * move.t
      rig.hold(move.around ? shotAt({ arrival: move.to }, move.from, move.t) : ratioZoom(move.from, move.to, move.t))
    } else if (shot.dir) {
      shot.p = advance(shot.p, shot.dir, dt)
      rig.hold(shotAt(shot.current!, shot.start, shot.p))
    }
    const peel = shot.current?.peel
    setWalls(peel ? wallsAt(peel, shot.p, open) : CLOSED)
    rig.update(dt, width, height)
    view?.instance.update(dt, view.step, camera)
    if (move?.t === 1) {
      const { to, done } = move
      move = null
      rig.hold(null)
      const d = to.position.distanceTo(to.target)
      if (done) rig.setLimits(null)
      else rig.setLimits([d * 0.5, d * 2], Math.PI / 2)
      done?.()
    }
    if ((shot.dir > 0 && shot.p === 1) || (shot.dir < 0 && shot.p === 0)) {
      if (shot.p === 0 && shot.next) Object.assign(shot, { current: shot.next, next: undefined, start: rig.pose(), dir: 1 })
      else {
        if (shot.p === 0) shot.current = null
        shot.dir = 0
        rig.hold(null)
      }
    }
    notify()
    renderer.render(scene, camera)
    for (const listener of listeners) listener(camera, width, height)
  })

  return {
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
      drop()
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
