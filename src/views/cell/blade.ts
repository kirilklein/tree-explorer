import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  type InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type Plane,
  TubeGeometry,
  Vector3,
} from 'three'
import { COLS, ROWS } from './frame'
import { fade, smooth } from './paint'

const SPLIT = 6

function subdivide(source: BufferGeometry) {
  const index = source.getIndex()!
  const position = source.getAttribute('position')
  const normal = source.getAttribute('normal')
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const corner = (v: number) => [
    ...new Vector3().fromBufferAttribute(position, v).toArray(),
    ...new Vector3().fromBufferAttribute(normal, v).toArray(),
    (v % COLS) / (COLS - 1),
    Math.floor(v / COLS) / ROWS,
  ]
  for (let k = 0; k < index.count; k += 3) {
    const [a, b, c] = [0, 1, 2].map((o) => corner(index.getX(k + o)))
    const push = (i: number, j: number) => {
      const [wb, wc] = [i / SPLIT, j / SPLIT]
      const v = a.map((x, n) => x * (1 - wb - wc) + b[n] * wb + c[n] * wc)
      positions.push(...v.slice(0, 3))
      normals.push(...new Vector3(v[3], v[4], v[5]).normalize().toArray())
      uvs.push(...v.slice(6))
    }
    for (let i = 0; i < SPLIT; i++) {
      for (let j = 0; j < SPLIT - i; j++) {
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1]]) push(i + di, j + dj)
        if (i + j < SPLIT - 1) for (const [di, dj] of [[1, 0], [1, 1], [0, 1]]) push(i + di, j + dj)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geometry
}

/** The upper sheet, and the lower sheet joined to it by a rim, so the blade is as thick as its tissue. */
function thicken(source: BufferGeometry, sheet: BufferGeometry, half: number) {
  const position = sheet.getAttribute('position')
  const normal = sheet.getAttribute('normal')
  const upper = sheet.clone()
  const raised = upper.getAttribute('position')
  const positions: number[] = []
  const normals: number[] = []
  const uvs = [...(sheet.getAttribute('uv').array as Float32Array)]
  const [p, n] = [new Vector3(), new Vector3()]
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i)
    n.fromBufferAttribute(normal, i)
    raised.setXYZ(i, ...p.clone().addScaledVector(n, half).toArray())
    positions.push(...p.addScaledVector(n, -half).toArray())
    normals.push(...n.negate().toArray())
  }
  const index = source.getIndex()!
  const corners = source.getAttribute('position')
  const facing = source.getAttribute('normal')
  const uses = new Map<string, [number, number, number]>()
  for (let k = 0; k < index.count; k += 3) {
    for (const o of [0, 1, 2]) {
      const [a, b] = [index.getX(k + o), index.getX(k + ((o + 1) % 3))]
      const key = `${Math.min(a, b)}-${Math.max(a, b)}`
      uses.set(key, [a, b, (uses.get(key)?.[2] ?? 0) + 1])
    }
  }
  for (const [a, b, count] of uses.values()) {
    if (count > 1) continue
    const [top, bottom] = [half, -half].map((h) =>
      [a, b].map((v) => new Vector3().fromBufferAttribute(corners, v).addScaledVector(n.fromBufferAttribute(facing, v), h)),
    )
    const out = top[1].clone().sub(top[0]).cross(n.fromBufferAttribute(facing, a)).normalize()
    const uv = (v: number) => [(v % COLS) / (COLS - 1), Math.floor(v / COLS) / ROWS]
    for (const [q, v] of [[top[0], a], [top[1], b], [bottom[1], b], [top[0], a], [bottom[1], b], [bottom[0], a]] as const) {
      positions.push(...q.toArray())
      normals.push(...out.toArray())
      uvs.push(...uv(v))
    }
  }
  const under = new BufferGeometry()
  under.setAttribute('position', new Float32BufferAttribute(positions, 3))
  under.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  under.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return { upper, under }
}

export function createBlade(leaves: InstancedMesh, index: number, cut: Plane[], half: number) {
  const color = new Color()
  leaves.getColorAt(index, color)
  const { upper: geometry, under } = thicken(leaves.geometry, subdivide(leaves.geometry), half)
  const base = { side: DoubleSide, roughness: 0.75, transparent: true, polygonOffset: true, clippingPlanes: cut, clipIntersection: true }
  const blade = new Mesh(
    geometry,
    new MeshStandardMaterial({ ...base, color, emissive: color, map: (leaves.material as MeshStandardMaterial).map, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  )
  blade.castShadow = true
  const underside = new Mesh(under, blade.material)
  const light = color.clone().lerp(new Color('#e2eeb2'), 0.55)
  const rib = new CatmullRomCurve3(
    Array.from({ length: ROWS }, (_, r) => new Vector3(0, r / ROWS, 0.12 * (r / ROWS) ** 2 + 0.002)).concat(
      new Vector3(0, 0.93, 0.12 * 0.93 ** 2 + 0.002),
    ),
  )
  const midrib = new Mesh(
    new TubeGeometry(rib, 48, 0.005, 8),
    new MeshStandardMaterial({ color: light, emissive: light, emissiveIntensity: 0.2, roughness: 0.6, transparent: true }),
  )
  const stalk = new Mesh(
    new CylinderGeometry(0.006, 0.009, 0.17, 12).translate(0, -0.085, 0).rotateX(0.12),
    new MeshStandardMaterial({ color: light, emissive: light, emissiveIntensity: 0.2, roughness: 0.6, transparent: true }),
  )
  const group = new Group().add(blade, underside, midrib, stalk)
  const point = (x: number, y: number, z: number) => {
    const o = new Object3D()
    o.position.set(x, y, z)
    group.add(o)
    return o
  }
  const [u, t] = [-0.47, 0.4925]
  const w = 0.32 * Math.sin(Math.PI * t * 1.08) ** 0.75
  return {
    group,
    labels: {
      midrib: point(0, 0.62, 0.12 * 0.62 ** 2),
      vein: point(u * w, t, 0.18 * u * u * w + 0.12 * t * t),
      stalk: point(0, -0.12, -0.012),
    },
    /** Lets go of the texture shared with the crown's leaves, so that freeing the view leaves it alone. */
    release() {
      blade.material.map = null
    },
    update(detail: number) {
      const plain = smooth(detail * 2)
      fade([blade, underside], plain)
      fade([midrib, stalk], smooth(detail * 2 - 1))
      ;(blade.material as MeshStandardMaterial).emissiveIntensity = 0.15 * smooth(detail * 2 - 1)
      return plain === 1
    },
  }
}
