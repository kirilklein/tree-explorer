import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three'
import { FLOOR, type Frame } from './frame'
import { ROWS } from './growth'
import { CELL as C, layerNamed, layersOf } from './layers'

export const WOOD_X = -1
export const PHLOEM_X = 2
export const TRACHEIDS = [
  { row: 2, height: 4 },
  { row: 3, height: 6.5 },
  { row: 4, height: 9 },
]
export const PITS = [3, 5.3]
export const SIEVE_ROW = 0
export const COMPANION_ROW = 1
export const SIEVE_HEIGHT = 7.5
export const PLATES = [2.4, 5.2]
export const PORES = [-0.22, 0, 0.22]

const BELOW = -0.6
const STEP = 0.05
const PIT_HALF = 0.32
const PLATE_THICKNESS = 0.12
const BEAD_Z = -0.16
const RISE_SECONDS = 1.4

interface Span {
  bottom: number
  top: number
  radius: number
  tipBottom: number
  tipTop: number
}

const radiusAt = ({ bottom, top, radius, tipBottom, tipTop }: Span, h: number) => {
  if (h < bottom || h > top) return 0
  const cap = (d: number, tip: number) => (tip > 0 && d < tip ? Math.sqrt(1 - ((tip - d) / tip) ** 2) : 1)
  return radius * cap(top - h, tipTop) * cap(h - bottom, tipBottom)
}

const lumenOf = (outer: Span, wall: number): Span => ({
  bottom: outer.bottom + (outer.tipBottom > 0 ? wall : 0),
  top: outer.top - (outer.tipTop > 0 ? wall : 0),
  radius: outer.radius - wall,
  tipBottom: Math.max(0, outer.tipBottom - wall),
  tipTop: Math.max(0, outer.tipTop - wall),
})

const heightsOf = ({ bottom, top }: Span) => {
  const count = Math.ceil((top - bottom) / STEP)
  return Array.from({ length: count + 1 }, (_, i) => bottom + ((top - bottom) * i) / count)
}

const shell = (span: Span) =>
  new LatheGeometry(heightsOf(span).map((h) => new Vector2(radiusAt(span, h) * C, h * C)), 16, Math.PI / 2, Math.PI)

/** The wall where the cut passes through it, with a gap at each pit. */
function cutFace(outer: Span, lumen: Span, pits: { side: number; at: number }[]) {
  const vertices: number[] = []
  const heights = heightsOf(outer)
  for (const side of [1, -1]) {
    heights.slice(1).forEach((h1, i) => {
      const h0 = heights[i]
      if (pits.some((p) => p.side === side && Math.abs((h0 + h1) / 2 - p.at) < PIT_HALF)) return
      const [i0, o0, i1, o1] = [radiusAt(lumen, h0), radiusAt(outer, h0), radiusAt(lumen, h1), radiusAt(outer, h1)].map((r) => side * r * C)
      vertices.push(i0, h0 * C, 0, o0, h0 * C, 0, o1, h1 * C, 0, i0, h0 * C, 0, o1, h1 * C, 0, i1, h1 * C, 0)
    })
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  const normal = new Float32Array(vertices.length)
  for (let i = 2; i < normal.length; i += 3) normal[i] = 1
  geometry.setAttribute('normal', new BufferAttribute(normal, 3))
  return geometry
}

interface Path {
  points: Vector3[]
  length: number
}

const pathOf = (points: Vector3[]): Path => ({
  points,
  length: points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(points[i]), 0),
})

export function along({ points }: Path, distance: number, out = new Vector3()) {
  let left = distance
  for (let i = 1; i < points.length; i++) {
    const span = points[i].distanceTo(points[i - 1])
    if (left <= span || i === points.length - 1) return out.lerpVectors(points[i - 1], points[i], Math.min(1, left / span))
    left -= span
  }
  return out.copy(points[0])
}

export function createTubes(frame: Frame, radius: number) {
  const { n, a } = frame
  const across = new Vector3().crossVectors(n, a)
  const { inner, outer } = layerNamed(layersOf(radius), 'Cambium')
  const origin = frame.at(FLOOR).addScaledVector(n, (inner + outer) / 2)
  const group = new Group()
  group.position.copy(origin)
  group.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(across.clone().negate(), a, n))
  group.updateMatrixWorld()
  const xOf = (row: number) => ((ROWS - 1) / 2 - row) * C
  const world = (x: number, h: number, z: number) => group.localToWorld(new Vector3(x, h * C, z))

  const clip = { clippingPlanes: [new Plane().setFromNormalAndCoplanarPoint(a, origin)], side: DoubleSide }
  const solid = (color: string, emissive = '#000000', glow = 0) =>
    new MeshStandardMaterial({ color, emissive, emissiveIntensity: glow, roughness: 0.8, ...clip })
  const flat = (color: string) => new MeshBasicMaterial({ color, toneMapped: false, ...clip })

  const tube = (x: number, z: number, outerSpan: Span, wall: number, pits: { side: number; at: number }[], materials: MeshStandardMaterial[]) => {
    const lumen = lumenOf(outerSpan, wall)
    const [outside, inside, face] = materials
    const part = new Group().add(new Mesh(shell(outerSpan), outside), new Mesh(shell(lumen), inside), new Mesh(cutFace(outerSpan, lumen, pits), face))
    part.position.set(x, 0, z)
    return part
  }

  const water = new Group()
  const wood = [solid('#e2cfa2'), solid('#c4a473'), solid('#fbf1d6')]
  const woodZ = WOOD_X * C
  const [xA, xB, xC] = TRACHEIDS.map((t) => xOf(t.row))
  TRACHEIDS.forEach(({ row, height }, i) => {
    const pits = [
      ...(i > 0 ? [{ side: Math.sign(xOf(TRACHEIDS[i - 1].row) - xOf(row)), at: PITS[i - 1] }] : []),
      ...(i < 2 ? [{ side: Math.sign(xOf(TRACHEIDS[i + 1].row) - xOf(row)), at: PITS[i] }] : []),
    ]
    water.add(tube(xOf(row), woodZ, { bottom: BELOW, top: height, radius: 0.5, tipBottom: 0, tipTop: 1.5 }, 0.16, pits, wood))
  })
  const opening = flat('#7a5a38')
  PITS.forEach((h, i) => {
    const hole = new Mesh(new PlaneGeometry(0.4 * C, 2 * PIT_HALF * C), opening)
    hole.position.set((xOf(TRACHEIDS[i].row) + xOf(TRACHEIDS[i + 1].row)) / 2, h * C, woodZ - 0.03 * C)
    water.add(hole)
  })
  const marks = new InstancedMesh(new CircleGeometry(0.07 * C, 12), flat('#a5855a'), 18)
  const m = new Matrix4()
  const q = new Quaternion()
  const one = new Vector3(1, 1, 1)
  const p = new Vector3()
  let mark = 0
  TRACHEIDS.forEach(({ row, height }) => {
    for (let h = 0.7; h < height - 1.6 && mark < marks.count; h += 1.3) {
      marks.setMatrixAt(mark++, m.compose(p.set(xOf(row) + (mark % 2 ? 0.1 : -0.1) * C, h * C, woodZ - 0.325 * C), q, one))
    }
  })
  marks.count = mark
  water.add(marks)

  const top = TRACHEIDS[2].height - 0.6
  const run = (points: [number, number][]) => pathOf(points.map(([x, h]) => new Vector3(x, h * C, woodZ + BEAD_Z * C)))
  const waterPaths = [
    run([[xA, BELOW], [xA, PITS[0]], [xB, PITS[0]], [xB, PITS[1]], [xC, PITS[1]], [xC, top]]),
    run([[xB, BELOW], [xB, PITS[1]], [xC, PITS[1]], [xC, top]]),
    run([[xC, BELOW], [xC, top]]),
  ]
  const drops = new InstancedMesh(new SphereGeometry(0.1 * C, 12, 8), solid('#4fa8ea', '#2f7fd0', 0.5), 36)
  water.add(drops)

  const sugar = new Group()
  const phloemZ = PHLOEM_X * C
  const xS = xOf(SIEVE_ROW)
  const xK = xOf(COMPANION_ROW)
  const living = [solid('#cfe0ac'), solid('#dcefb4', '#c4f27e', 0.25), solid('#f4fbe0')]
  const sieve: Span = { bottom: BELOW, top: SIEVE_HEIGHT, radius: 0.47, tipBottom: 0, tipTop: 0 }
  sugar.add(tube(xS, phloemZ, sieve, 0.07, [], living))
  const plate = solid('#a9c283')
  const pore = flat('#3b4a26')
  const lumenRadius = (sieve.radius - 0.07) * C
  const pores = new InstancedMesh(new CircleGeometry(0.07 * C, 12).rotateX(-Math.PI / 2), pore, PLATES.length * 6)
  const slots = new InstancedMesh(new PlaneGeometry(0.14 * C, PLATE_THICKNESS * C), pore, PLATES.length * PORES.length)
  PLATES.forEach((h, k) => {
    const disc = new Mesh(new CylinderGeometry(lumenRadius, lumenRadius, PLATE_THICKNESS * C, 20, 1, false, Math.PI / 2, Math.PI), plate)
    const front = new Mesh(new PlaneGeometry(2 * lumenRadius, PLATE_THICKNESS * C), plate)
    disc.position.set(xS, h * C, phloemZ)
    front.position.copy(disc.position)
    sugar.add(disc, front)
    const above = (h + PLATE_THICKNESS / 2 + 0.004) * C
    PORES.forEach((x, i) => {
      slots.setMatrixAt(k * PORES.length + i, m.compose(p.set(xS + x * C, h * C, phloemZ + 0.002 * C), q, one))
      pores.setMatrixAt(k * 6 + i, m.compose(p.set(xS + x * C, above, phloemZ + BEAD_Z * C), q, one))
    })
    ;[-0.12, 0.12, 0].forEach((x, i) => {
      pores.setMatrixAt(k * 6 + 3 + i, m.compose(p.set(xS + x * C, above, phloemZ - (i < 2 ? 0.3 : 0.36) * C), q, one))
    })
  })
  const companion = [solid('#c4dc9a'), solid('#e2f5b6', '#c4f27e', 0.6), solid('#f4fbe0')]
  const nucleus = solid('#5f8f3a')
  const ends = [BELOW, ...PLATES, SIEVE_HEIGHT]
  const cells = ends.slice(1).map((end, i) => ({ bottom: i ? ends[i] + 0.1 : BELOW, top: end - 0.1 }))
  cells.forEach(({ bottom, top: end }, i) => {
    sugar.add(tube(xK, phloemZ, { bottom, top: end, radius: 0.36, tipBottom: i ? 0.35 : 0, tipTop: 0.35 }, 0.06, [], companion))
    const core = new Mesh(new SphereGeometry(0.15 * C, 14, 10), nucleus)
    core.position.set(xK, Math.max(1, (bottom + end) / 2) * C, phloemZ - 0.08 * C)
    sugar.add(core)
  })
  const sugarPaths = PORES.map((x) =>
    pathOf([SIEVE_HEIGHT - 0.2, BELOW].map((h) => new Vector3(xS + x * C, h * C, phloemZ + BEAD_Z * C))),
  )
  const grains = new InstancedMesh(new SphereGeometry(0.09 * C, 12, 8), solid('#f2a93b', '#c97a12', 0.4), 24)
  sugar.add(pores, slots, grains)

  group.add(water, sugar)

  const offsets = Array.from({ length: drops.count }, (_, i) => new Vector3(Math.sin(i * 2.4) * 0.1, Math.cos(i * 1.7) * 0.1, Math.sin(i * 0.9) * 0.06).multiplyScalar(C))
  const fade = (d: number) => MathUtils.smoothstep(d, 0, 0.5 * C)
  const moving = [
    { mesh: drops, paths: waterPaths, speed: 1.2 * C, jitter: 1 },
    { mesh: grains, paths: sugarPaths, speed: 0.9 * C, jitter: 0 },
  ]
  const sets = [
    { part: water, height: (TRACHEIDS[2].height + 0.05) * C, raised: 0 },
    { part: sugar, height: (SIEVE_HEIGHT + 0.05) * C, raised: 0 },
  ]
  let time = 0

  function update(dt: number, up: boolean[], shown: number) {
    time += dt
    sets.forEach((set, i) => {
      set.raised = MathUtils.clamp(set.raised + (up[i] ? dt : -dt) / RISE_SECONDS, 0, 1)
      const lift = MathUtils.smoothstep(set.raised, 0, 1) * shown
      set.part.position.y = (lift - 1) * set.height
      set.part.visible = lift > 0.001
    })
    for (const { mesh, paths, speed, jitter } of moving) {
      const each = mesh.count / paths.length
      for (let i = 0; i < mesh.count; i++) {
        const lane = Math.floor(i / each)
        const path = paths[lane]
        const d = (time * speed + (((i % each) + lane / paths.length) / each) * path.length + i * 0.37 * C * jitter) % path.length
        along(path, d, p).addScaledVector(offsets[i], jitter)
        mesh.setMatrixAt(i, m.compose(p, q, one.setScalar(fade(d) * fade(path.length - d))))
      }
      one.setScalar(1)
      mesh.instanceMatrix.needsUpdate = true
    }
  }
  update(0, [false, false], 0)

  return {
    group,
    update,
    waterPaths: waterPaths.map((path) => path.points.map((v) => group.localToWorld(v.clone()))),
    sugarPaths: sugarPaths.map((path) => path.points.map((v) => group.localToWorld(v.clone()))),
    points: {
      tracheid: world(xB, 1.6, woodZ),
      pit: world((xA + xB) / 2, PITS[0], woodZ),
      water: world(xC, 3.4, woodZ),
      sieve: world(xS, 4.7, phloemZ),
      plate: world(xS, PLATES[0], phloemZ),
      companion: world(xK, 1.2, phloemZ),
      sugar: world(xS, 3.4, phloemZ),
    },
  }
}
