import {
  BufferGeometry,
  CanvasTexture,
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
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three'
import { mulberry32 } from '../../scene/tree'
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

function veinTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const at = (u: number, v: number) => [u * size, (1 - v) * size] as const
  g.strokeStyle = 'rgba(226, 238, 178, 0.9)'
  g.lineCap = 'round'
  g.lineWidth = 18
  g.beginPath()
  g.moveTo(...at(0.5, 0))
  g.lineTo(...at(0.5, 0.94))
  g.stroke()
  const veins: [number, number][][] = []
  for (let k = 0; k < 7; k++) {
    const v = 0.08 + k * 0.115
    for (const side of [-1, 1]) {
      g.lineWidth = 8 - k * 0.6
      g.beginPath()
      g.moveTo(...at(0.5, v))
      g.quadraticCurveTo(...at(0.5 + side * 0.24, v + 0.05), ...at(0.5 + side * 0.46, v + 0.17))
      g.stroke()
      veins.push([0.25, 0.5, 0.75].map((s) => [0.5 + side * 0.46 * s, v + 0.17 * s * s + 0.02 * s]))
    }
  }
  const rand = mulberry32(19)
  g.lineWidth = 2.5
  g.strokeStyle = 'rgba(226, 238, 178, 0.55)'
  for (let i = 0; i < 700; i++) {
    const [u, v] = [rand(), rand() * 0.92]
    const angle = rand() * Math.PI * 2
    g.beginPath()
    g.moveTo(...at(u, v))
    g.lineTo(...at(u + Math.cos(angle) * 0.035, v + Math.sin(angle) * 0.02))
    g.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return { texture, vein: veins[6][1] }
}

export function createBlade(leaves: InstancedMesh, index: number, cut: Plane[]) {
  const color = new Color()
  leaves.getColorAt(index, color)
  const geometry = subdivide(leaves.geometry)
  const base = { side: DoubleSide, roughness: 0.75, transparent: true, polygonOffset: true, clippingPlanes: cut, clipIntersection: true }
  const blade = new Mesh(
    geometry,
    new MeshStandardMaterial({ ...base, color, emissive: color, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
  )
  blade.castShadow = true
  const { texture, vein } = veinTexture()
  const veins = new Mesh(
    geometry,
    new MeshStandardMaterial({ ...base, map: texture, depthWrite: false, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  )
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
  const group = new Group().add(blade, veins, midrib, stalk)
  const point = (x: number, y: number, z: number) => {
    const o = new Object3D()
    o.position.set(x, y, z)
    group.add(o)
    return o
  }
  const [u, t] = [vein[0] * 2 - 1, vein[1]]
  const w = 0.32 * Math.sin(Math.PI * t * 1.08) ** 0.75
  return {
    group,
    labels: {
      midrib: point(0, 0.62, 0.12 * 0.62 ** 2),
      vein: point(u * w, t, 0.18 * u * u * w + 0.12 * t * t),
      stalk: point(0, -0.12, -0.012),
    },
    update(detail: number) {
      const plain = smooth(detail * 2)
      fade([blade], plain)
      fade([veins, midrib, stalk], smooth(detail * 2 - 1))
      ;(blade.material as MeshStandardMaterial).emissiveIntensity = 0.15 * smooth(detail * 2 - 1)
      return plain === 1
    },
  }
}
