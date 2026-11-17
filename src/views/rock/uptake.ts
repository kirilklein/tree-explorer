import {
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Vector3,
} from 'three'
import type { Site } from './frame'

export const BACK = 0.105
export const LENGTH = 0.055
export const FILES = 22
export const HAIR_FILE = 15
export const HAIR_LENGTH = 0.03
const HAIR_RADIUS = 0.0012
const STEP = Math.PI / FILES
/** Radii as fractions of the root's radius, from the centre out. */
export const RINGS = { stele: 0.38, endodermis: 0.44, cortex: 0.9, epidermis: 0.99 }
const CORTEX = [0.5, 0.6, 0.7, 0.8]
const ARM = Math.PI / 4
const XYLEM = [0.04, 0.13, 0.22, 0.31]

const COLORS = {
  ground: '#b39470',
  epidermis: '#ecd6ad',
  cortex: '#f6ead0',
  endodermis: '#e3bf86',
  strip: '#a0452a',
  stele: '#d6c09a',
  xylem: '#9fb3c2',
  phloem: '#d9c88c',
  hair: '#f3ecdc',
  water: '#4fa8ea',
}

const UP = new Vector3(0, 1, 0)
/** The side of the root that the cut opens on. */
export const cutSide = (direction: Vector3) => new Vector3().crossVectors(UP, direction).normalize().multiplyScalar(0.55).addScaledVector(UP, 0.35)
export const HAIR_ANGLE = -Math.PI / 2 + (HAIR_FILE + 0.5) * (Math.PI / FILES)

const fileAngle = (file: number) => -Math.PI / 2 + (file + 0.5) * STEP
const polar = (rho: number, angle: number, z = 0) => new Vector3(rho * Math.cos(angle), rho * Math.sin(angle), z)

/** The way of one water drop across the cut face, in the face's own frame, for a root of radius 1. */
export function waterPath(enter: number) {
  const hair = fileAngle(HAIR_FILE)
  const gap = hair + STEP / 2
  return [
    polar(1 + enter, hair).add(polar(0.1, hair + Math.PI / 2)),
    polar(1 + enter, hair),
    polar(RINGS.epidermis, hair),
    polar(RINGS.cortex, gap),
    polar(RINGS.endodermis + 0.02, gap),
    polar(RINGS.endodermis + 0.02, hair),
    polar(RINGS.stele - 0.02, hair),
    polar(XYLEM[3], ARM),
  ]
}

function faceCells(radius: number) {
  const blocks: { at: Vector3; turn: number; size: [number, number]; color: string }[] = []
  const rounds: typeof blocks = []
  const ring = (inner: number, outer: number, count: number, color: string, fill = 0.9) => {
    const step = Math.PI / count
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (i + 0.5) * step
      const mid = ((inner + outer) / 2) * radius
      blocks.push({ at: polar(mid, angle), turn: angle, size: [(outer - inner) * radius * 0.94, mid * step * fill], color })
    }
  }
  ring(RINGS.cortex, RINGS.epidermis, FILES * 2, COLORS.epidermis)
  ring(RINGS.stele, RINGS.endodermis, FILES, COLORS.endodermis, 0.8)
  for (let i = 1; i < FILES; i++) {
    const angle = -Math.PI / 2 + i * STEP
    const mid = ((RINGS.stele + RINGS.endodermis) / 2) * radius
    blocks.push({ at: polar(mid, angle, 1e-5), turn: angle, size: [(RINGS.endodermis - RINGS.stele) * radius * 0.5, mid * STEP * 0.24], color: COLORS.strip })
  }
  for (const rho of CORTEX) {
    for (let file = 0; file < FILES; file++) {
      rounds.push({ at: polar(rho * radius, fileAngle(file)), turn: fileAngle(file), size: [0.046 * radius, rho * radius * STEP * 0.36], color: COLORS.cortex })
    }
  }
  for (const side of [-1, 1]) {
    XYLEM.forEach((rho, k) => {
      const size = (0.05 - 0.008 * k) * radius
      rounds.push({ at: polar(rho * radius, side * ARM), turn: 0, size: [size, size], color: COLORS.xylem })
    })
    for (const [rho, angle] of [[0.2, 0], [0.26, 0.12], [0.26, -0.12], [0.23, side * 1.45]]) {
      rounds.push({ at: polar(rho * radius, angle), turn: 0, size: [0.022 * radius, 0.022 * radius], color: COLORS.phloem })
    }
  }
  return { blocks, rounds }
}

const WALL_BANDS: [number, string][] = [
  [0.06, COLORS.xylem],
  [RINGS.stele, COLORS.stele],
  [RINGS.endodermis, COLORS.endodermis],
  [RINGS.cortex, COLORS.cortex],
  [RINGS.epidermis, COLORS.epidermis],
]

function wallGeometry(radius: number) {
  const positions: number[] = []
  const colors: number[] = []
  const color = new Color()
  let inner = 0
  for (const [outer, hex] of WALL_BANDS) {
    color.set(hex).multiplyScalar(0.9)
    for (const side of [-1, 1]) {
      const [y0, y1] = [side * inner * radius, side * outer * radius]
      positions.push(0, y0, 0, 0, y1, 0, 0, y1, 1, 0, y0, 0, 0, y1, 1, 0, y0, 1)
      for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b)
    }
    inner = outer
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

function fan(rim: number[]) {
  const positions = [0, 0, 0]
  rim.forEach((r, i) => positions.push(...polar(r, -Math.PI / 2 + (i / (rim.length - 1)) * Math.PI).toArray()))
  const index: number[] = []
  for (let i = 1; i < rim.length; i++) index.push(0, i, i + 1)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

export function uptakeFrame({ tip, direction }: Site) {
  const w = cutSide(direction).projectOnPlane(direction).normalize()
  const origin = tip.clone().addScaledVector(direction, -BACK)
  const matrix = new Matrix4().makeBasis(w, new Vector3().crossVectors(direction, w), direction).setPosition(origin)
  const at = (rho: number, angle: number) => polar(rho, angle).applyMatrix4(matrix)
  return { w, origin, matrix, at }
}

export function createUptake(site: Site, root: Mesh, hairs: InstancedMesh, grains: InstancedMesh) {
  const { direction } = site
  const { w, origin, matrix } = uptakeFrame(site)
  const group = new Group()
  group.applyMatrix4(matrix)
  group.updateMatrixWorld()

  const ray = new Raycaster()
  root.updateWorldMatrix(true, false)
  const rimAt = (z: number) =>
    Array.from({ length: 41 }, (_, i) => {
      const out = polar(1, -Math.PI / 2 + (i / 40) * Math.PI).transformDirection(matrix)
      const from = origin.clone().addScaledVector(direction, z).addScaledVector(out, 1)
      ray.set(from, out.negate())
      return 0.999 * (1 - ray.intersectObject(root)[0].distance)
    })
  const rim = rimAt(0)
  const radius = Math.min(...rim)

  const lit = (color: string) => new MeshBasicMaterial({ color, side: DoubleSide })
  const face = new Mesh(fan(rim), lit(COLORS.ground))
  const far = new Mesh(fan(rimAt(LENGTH)), lit(COLORS.ground))
  const wall = new Mesh(wallGeometry(radius), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }))
  const cells = faceCells(radius)
  const m = new Matrix4()
  const q = new Quaternion()
  const z = new Vector3(0, 0, 1)
  const color = new Color()
  const instanced = (geometry: BufferGeometry, list: typeof cells.blocks) => {
    const mesh = new InstancedMesh(geometry, lit('#ffffff'), list.length)
    list.forEach(({ at, turn, size, color: hex }, i) => {
      mesh.setMatrixAt(i, m.compose(at.clone().setZ(at.z + 5e-5), q.setFromAxisAngle(z, turn), new Vector3(size[0], size[1], 1)))
      mesh.setColorAt(i, color.set(hex))
    })
    return mesh
  }
  const blocks = instanced(new PlaneGeometry(1, 1), cells.blocks)
  const rounds = instanced(new CircleGeometry(1, 18), cells.rounds)
  const cut = new Group().add(face, far, wall, blocks, rounds)
  group.add(cut)

  const hairAngle = fileAngle(HAIR_FILE)
  const hairBase = rim[Math.round(((hairAngle + Math.PI / 2) / Math.PI) * 40)]
  const hair = new Mesh(
    new CylinderGeometry(HAIR_RADIUS * 0.8, HAIR_RADIUS, HAIR_LENGTH, 12).translate(0, HAIR_LENGTH / 2, 0),
    new MeshStandardMaterial({ color: COLORS.hair, roughness: 0.6, transparent: true, opacity: 0, depthWrite: false }),
  )
  hair.position.copy(polar(hairBase * 0.97, hairAngle))
  hair.rotation.z = hairAngle - Math.PI / 2
  const drops = new InstancedMesh(
    new SphereGeometry(0.0006, 12, 8),
    new MeshStandardMaterial({ color: COLORS.water, emissive: '#2f7fd0', emissiveIntensity: 0.5, roughness: 0.5 }),
    20,
  )
  group.add(hair, drops)

  const scaled = (p: Vector3) => p.multiplyScalar(radius).setZ(3e-4)
  const paths = [0.75, 0.55, 0.35, 0.15].map((enter) => {
    const points = waterPath((enter * HAIR_LENGTH) / radius).map(scaled)
    const lengths = points.slice(1).map((p, i) => p.distanceTo(points[i]))
    return { points, lengths, total: lengths.reduce((sum, l) => sum + l, 0) }
  })
  const along = ({ points, lengths }: (typeof paths)[number], distance: number, out: Vector3) => {
    let left = distance
    for (let i = 0; i < lengths.length; i++) {
      if (left <= lengths[i] || i === lengths.length - 1) return out.lerpVectors(points[i], points[i + 1], Math.min(1, left / lengths[i]))
      left -= lengths[i]
    }
    return out
  }

  const planes = [new Plane(), new Plane(), new Plane().setFromNormalAndCoplanarPoint(w.clone().negate(), origin)]
  planes[1].setFromNormalAndCoplanarPoint(direction.clone().negate(), origin)
  const material = root.material as MeshStandardMaterial
  const before = { planes: material.clippingPlanes, intersection: material.clipIntersection }
  material.clippingPlanes = planes
  material.clipIntersection = true

  const inWay = (mesh: InstancedMesh, ahead: number) => {
    const list: { index: number; matrix: Matrix4 }[] = []
    const p = new Vector3()
    for (let i = 0; i < mesh.count; i++) {
      const own = new Matrix4()
      mesh.getMatrixAt(i, own)
      p.setFromMatrixPosition(own).sub(origin)
      if (p.dot(w) > -0.003 && p.dot(direction) > -0.004 && p.dot(direction) < ahead) list.push({ index: i, matrix: own })
    }
    return list
  }
  const cleared = [
    { mesh: hairs, list: inWay(hairs, LENGTH + 0.03) },
    { mesh: grains, list: inWay(grains, 0.12) },
  ]
  const shrink = new Matrix4()
  const one = new Vector3()
  const p = new Vector3()
  let time = 0
  let shown = 0
  let amount = 0
  let open = -1

  function setOpen(value: number) {
    if (value === open) return
    open = value
    const length = LENGTH * open
    planes[0].setFromNormalAndCoplanarPoint(direction, origin.clone().addScaledVector(direction, length))
    cut.visible = open > 0.001
    wall.scale.z = Math.max(length, 1e-6)
    far.position.z = length
    for (const { mesh, list } of cleared) {
      for (const { index, matrix: own } of list) mesh.setMatrixAt(index, shrink.copy(own).scale(one.setScalar(1 - open)))
      mesh.instanceMatrix.needsUpdate = true
    }
  }
  setOpen(0)

  const world = (v: Vector3) => group.localToWorld(v)
  return {
    group,
    radius,
    update(dt: number, show: boolean, cutOpen: boolean, near: number) {
      time += dt
      shown += ((show ? 1 : 0) - shown) * Math.min(1, dt * 2.5)
      amount = Math.min(1, Math.max(0, amount + (cutOpen ? dt : -dt) / 1.6))
      setOpen(amount * amount * (3 - 2 * amount) * near)
      hair.material.opacity = 0.6 * shown * near
      hair.visible = drops.visible = hair.material.opacity > 0.01
      if (!drops.visible) return
      const each = drops.count / paths.length
      for (let i = 0; i < drops.count; i++) {
        const path = paths[Math.floor(i / each)]
        const d = (time * 0.008 + (((i % each) + Math.floor(i / each) / paths.length) / each) * path.total) % path.total
        const fade = Math.min(1, d / 0.002, (path.total - d) / 0.004)
        drops.setMatrixAt(i, m.compose(along(path, d, p), q.identity(), one.setScalar(Math.max(0, fade) * shown * near)))
      }
      drops.instanceMatrix.needsUpdate = true
    },
    restore() {
      material.clippingPlanes = before.planes
      material.clipIntersection = before.intersection
    },
    points: {
      hair: world(polar(hairBase + HAIR_LENGTH * 0.55, hairAngle)),
      hairTip: world(polar(hairBase + HAIR_LENGTH * 0.9, hairAngle)),
      face: world(polar(radius * 0.62, hairAngle - 0.25)),
      epidermis: world(polar(radius * 0.95, hairAngle - 0.45)),
      cortex: world(polar(radius * 0.7, hairAngle - 0.75)),
      endodermis: world(polar(radius * 0.41, fileAngle(HAIR_FILE - 10))),
      strip: world(polar(radius * 0.41, fileAngle(HAIR_FILE - 6) + STEP / 2)),
      xylem: world(polar(radius * XYLEM[1], -ARM)),
    },
  }
}
