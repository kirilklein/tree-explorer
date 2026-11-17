import {
  BoxGeometry,
  type BufferGeometry,
  CatmullRomCurve3,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32, type Tree } from '../../scene/tree'
import { addWind } from '../../scene/wind'
import { type Network, newSample, type Path, sample } from './paths'

export const WATER_DEPTH = 0.5
export const SUGAR_DEPTH = 0.86
const FILES = 8
const SPACING = 0.24
const WATER_SPEED = 0.45
const SUGAR_SPEED = 0.32
const SUGARS = 700
const SOIL = 360
const VAPOUR = 260
const VAPOUR_SECONDS = 4.5
const UP = new Vector3(0, 1, 0)

/** Per-instance alpha from `aFade`, thinning towards the rim so each puff has no hard outline. */
function softEdges(material: Material) {
  const wind = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    wind(shader, renderer)
    shader.vertexShader = `attribute float aFade;\nvarying float vFade;\n${shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvFade = aFade;',
    )}`
    shader.fragmentShader = `varying float vFade;\n${shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'diffuseColor.a *= vFade * pow(abs(dot(normal, normalize(vViewPosition))), 2.0);\n#include <opaque_fragment>',
    )}`
  }
  material.customProgramCacheKey = () => 'vapour'
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const nearest = (points: Vector3[], to: Vector3) =>
  points.reduce((best, p) => (p.distanceTo(to) < best.distanceTo(to) ? p : best)).clone()
const wrap = (x: number, n: number) => ((x % n) + n) % n

function swarm(geometry: BufferGeometry, material: Material, count: number, wind: boolean) {
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.frustumCulled = false
  const sway = new InstancedBufferAttribute(new Float32Array(count), 1)
  geometry.setAttribute('aSway', sway)
  if (wind) addWind(mesh, false)
  return { mesh, sway }
}

const glow = (color: string, emissive: string) => new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.55, roughness: 0.35 })

export function createStreams(tree: Tree, network: Network, crown: Vector3, roots: Vector3) {
  const rand = mulberry32(17)
  const near = (points: Vector3[], at: Vector3, within: number) =>
    points.map((_, i) => i).filter((i) => points[i].distanceTo(at) < within)
  const featuredTwigs = near(network.twigs, crown, 2.6)
  const featuredRoots = near(network.rootEnds, roots, 2.8)
  const pick = (featured: number[], count: number) =>
    rand() < 0.45 ? featured[Math.floor(rand() * featured.length)] : Math.floor(rand() * count)
  const cache = new Map<number, Path>()
  const pathFor = (r: number, t: number) => {
    const key = r * 1000 + t
    if (!cache.has(key)) cache.set(key, network.path(r, t))
    return cache.get(key)!
  }
  const randomPath = () => pathFor(pick(featuredRoots, network.rootEnds.length), pick(featuredTwigs, network.twigs.length))

  const sMin = Math.min(...network.rootEnds.map((_, r) => pathFor(r, 0).s[0]))
  const sMax = Math.max(...network.twigs.map((_, t) => pathFor(0, t).s.at(-1)!))
  const slots = Math.ceil((sMax - sMin + 0.5) / SPACING)
  const loop = slots * SPACING
  const water = swarm(new SphereGeometry(1, 10, 8), glow('#3aa2f0', '#1667c4'), FILES * slots, true)
  const beads = Array.from({ length: water.mesh.count }, (_, i) => ({
    path: randomPath(),
    angle: ((i % FILES) / FILES) * Math.PI * 2,
    offset: Math.floor(i / FILES) * SPACING,
  }))

  const sugar = swarm(new BoxGeometry(1, 1, 1), glow('#f4a52e', '#b36200'), SUGARS, true)
  const grains = Array.from({ length: SUGARS }, () => ({ path: randomPath(), angle: rand() * Math.PI * 2, offset: rand() * loop }))

  const open = network.rootEnds.map((_, i) => i).filter((i) => network.rootEnds[i].x > 0.3 && network.rootEnds[i].z > 0.3)
  const soil = swarm(new SphereGeometry(1, 8, 6), glow('#5cb6f2', '#1667c4'), SOIL, false)
  const drops = Array.from({ length: SOIL }, (_, k) => {
    const r = open[k % open.length]
    const tip = network.rootEnds[r]
    const away = new Vector3(rand() - 0.5, (rand() - 0.6) * 0.6, rand() - 0.5).normalize()
    return { path: pathFor(r, 0), from: tip.clone().addScaledVector(away, 0.45 + 0.45 * rand()), phase: rand() }
  })

  const centers = tree.leaves.map((l) => new Vector3(0, 0.5 * l.scale, 0).applyQuaternion(l.quaternion).add(l.position))
  const middle = centers.reduce((sum, c) => sum.add(c), new Vector3()).divideScalar(centers.length)
  const reach = (i: number) => Math.hypot(centers[i].x - middle.x, (centers[i].y - middle.y) * 1.6, centers[i].z - middle.z)
  const edge = Math.max(...centers.map((_, i) => reach(i))) * 0.6
  const outer = centers.map((_, i) => i).filter((i) => reach(i) > edge)
  const featuredLeaves = near(centers, crown, 2.2).filter((i) => outer.includes(i))
  const fade = new InstancedBufferAttribute(new Float32Array(VAPOUR), 1)
  const vapour = swarm(
    new SphereGeometry(1, 12, 8),
    new MeshStandardMaterial({ color: '#ffffff', emissive: '#e8f4ff', emissiveIntensity: 0.6, transparent: true, depthWrite: false }),
    VAPOUR,
    true,
  )
  vapour.mesh.geometry.setAttribute('aFade', fade)
  vapour.mesh.renderOrder = 3
  softEdges(vapour.mesh.material as Material)
  const puffs = Array.from({ length: VAPOUR }, () => {
    const i = rand() < 0.6 ? featuredLeaves[Math.floor(rand() * featuredLeaves.length)] : outer[Math.floor(rand() * outer.length)]
    const leaf = tree.leaves[i]
    const away = centers[i].clone().sub(middle).normalize()
    const drift = away.addScaledVector(UP, 0.8).add(new Vector3(rand() - 0.5, rand() * 0.3, rand() - 0.5).multiplyScalar(0.7)).normalize()
    return { from: centers[i], drift, sway: leaf.sway, phase: rand(), size: 0.7 + 0.6 * rand() }
  })

  const reference = pathFor(0, 0)
  const top = reference.s[reference.points.findIndex((p) => p.y > network.forkHeight - 0.5)]
  const threads = new Mesh(
    mergeGeometries(
      Array.from({ length: FILES }, (_, f) => {
        const points = Array.from({ length: 30 }, (_, k) =>
          sample(reference, 0.15 + ((top - 0.15) * k) / 29, WATER_DEPTH, (f / FILES) * Math.PI * 2, newSample()).position.clone(),
        )
        return new TubeGeometry(new CatmullRomCurve3(points), 60, 0.009, 5)
      }),
    ),
    new MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0, depthWrite: false }),
  )
  threads.renderOrder = 0

  const at = newSample()
  const m = new Matrix4()
  const q = new Quaternion()
  const size = new Vector3()
  const p = new Vector3()
  let time = 0

  function update(dt: number, show: { water: number; sugar: number; soil: number; vapour: number; threads: number }, boost: number) {
    time += dt
    beads.forEach(({ path, angle, offset }, i) => {
      const s = sMin + wrap(offset + WATER_SPEED * time, loop)
      const fade = smooth((s - path.s[0]) / 0.4) * smooth((path.s.at(-1)! - s) / 0.25)
      if (fade * show.water === 0) return water.mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
      sample(path, s, WATER_DEPTH, angle, at)
      const r = Math.min(0.05, Math.max(0.014, 0.3 * at.radius)) * boost * fade * show.water
      water.mesh.setMatrixAt(i, m.compose(at.position, q.identity(), size.setScalar(r)))
      water.sway.setX(i, at.sway)
    })

    grains.forEach(({ path, angle, offset }, i) => {
      const length = path.s.at(-1)! - path.s[0]
      const s = path.s.at(-1)! - wrap(offset + SUGAR_SPEED * time, length + 1)
      const fade = smooth((s - path.s[0]) / 0.3) * smooth((path.s.at(-1)! - s) / 0.3)
      if (fade * show.sugar === 0) return sugar.mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
      sample(path, s, SUGAR_DEPTH, angle, at)
      const w = Math.min(0.045, Math.max(0.01, 0.12 * at.radius)) * boost * fade * show.sugar
      q.setFromUnitVectors(UP, at.tangent)
      sugar.mesh.setMatrixAt(i, m.compose(at.position, q, size.set(w, w * 3, w)))
      sugar.sway.setX(i, at.sway)
    })

    drops.forEach(({ path, from, phase }, i) => {
      const t = wrap(phase + time / 3.2, 1)
      if (show.soil === 0) return soil.mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
      const inside = smooth((t - 0.62) / 0.38)
      if (t < 0.62) p.lerpVectors(from, path.points[0], smooth(t / 0.62))
      else p.copy(sample(path, path.s[0] + 0.5 * inside, WATER_DEPTH, 0, at).position)
      const r = 0.02 * smooth(t * 8) * (1 - inside) * show.soil
      soil.mesh.setMatrixAt(i, m.compose(p, q.identity(), size.setScalar(r)))
    })

    puffs.forEach(({ from, drift, sway, phase, size: grow }, i) => {
      const t = wrap(phase + time / VAPOUR_SECONDS, 1)
      const r = (0.03 + 0.13 * t) * grow * (show.vapour > 0 ? 1 : 0)
      p.copy(from).addScaledVector(drift, 0.05 + 0.8 * t)
      vapour.mesh.setMatrixAt(i, m.compose(p, q.identity(), size.setScalar(r)))
      vapour.sway.setX(i, sway)
      fade.setX(i, 0.5 * smooth(t * 5) * smooth((1 - t) * 1.6) * show.vapour)
    })

    for (const { mesh, sway } of [water, sugar, soil, vapour]) {
      mesh.instanceMatrix.needsUpdate = true
      sway.needsUpdate = true
    }
    fade.needsUpdate = true
    threads.material.opacity = 0.4 * show.threads
    threads.visible = show.threads > 0.01
  }

  const rootPoint = nearest(network.rootEnds, roots)
  const leafPoint = nearest(featuredLeaves.map((i) => centers[i]), crown)
  const labelled = puffs.reduce((best, f) => (f.from.distanceTo(leafPoint) < best.from.distanceTo(leafPoint) ? f : best))
  return {
    parts: [water.mesh, sugar.mesh, soil.mesh, vapour.mesh, threads],
    update,
    leafPoint,
    vapourPoint: labelled.from.clone().addScaledVector(labelled.drift, 0.8),
    rootPoint,
    soilPoint: nearest(
      drops.map((d) => d.from).filter((p) => p.y < rootPoint.y - 0.3 && p.x - p.z < rootPoint.x - rootPoint.z),
      rootPoint.clone().add(new Vector3(-0.2, -0.5, 0.2)),
    ),
  }
}
