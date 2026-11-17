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
  WebGLRenderer,
} from 'three'
import { OVERVIEW } from '../data/stops'
import type { View, ViewInstance } from '../views/types'
import { createCameraRig } from './camera'
import { createGround } from './ground'
import { generateTree } from './tree'
import { createTreeMeshes } from './treeMesh'
import { windTime } from './wind'

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

  const { wood, roots, leaves } = createTreeMeshes(generateTree())
  const tree = new Group().add(wood, roots, leaves, createGround())
  scene.add(tree)

  const camera = new PerspectiveCamera(38, 1, 0.1, 200)
  const rig = createCameraRig(camera, renderer.domElement, OVERVIEW)

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

  let view: { instance: ViewInstance; step: number } | null = null

  function showView(next: View | null) {
    if (view) {
      scene.remove(view.instance.group)
      view.instance.dispose()
      view = null
    }
    tree.visible = !next
    scene.background = null
    rig.setLimits(null)
    if (!next) return null
    const instance = next.create()
    scene.add(instance.group)
    if (instance.background) scene.background = new Color(instance.background)
    rig.setLimits(instance.distance ?? [1, 20])
    view = { instance, step: 0 }
    return instance
  }

  const timer = new Timer()
  renderer.setAnimationLoop((time) => {
    timer.update(time)
    const dt = Math.min(timer.getDelta(), 0.1)
    if (view) view.instance.update(dt, view.step)
    else windTime.value = timer.getElapsed()
    rig.update(dt, width, height)
    renderer.render(scene, camera)
    for (const listener of listeners) listener(camera, width, height)
  })

  return {
    flyTo: rig.flyTo,
    showView,
    showStep(step: number) {
      if (!view) return
      view.step = step
      rig.flyTo(view.instance.poses[step])
    },
    setInset: rig.setInset,
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
