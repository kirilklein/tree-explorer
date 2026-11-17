import {
  type BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { mulberry32 } from '../../scene/tree'
import { BLOCK, C, NOTCH } from './frame'
import { fade, paint, smooth } from './paint'
import { CELL } from './poses'

export const PALISADE = { radius: 0.42 * C, length: 1.56 * C, color: '#9cc86a' }
const PLASTID = '#3c8a36'
const NEAR = 3 * C
const STOMA = new Vector3(3 * C, -2.78 * C, -0.75 * C)
const VEIN = new Vector3(-3.5 * C, -1.15 * C, 0)

interface Place {
  at: Vector3
  scale: Vector3
  turn?: Quaternion
  near?: boolean
}

const inNotch = (p: Vector3) => Math.abs(p.x) < NOTCH.half && p.z > 0
const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
const isNear = (p: Vector3) => Math.hypot(p.x - CELL.x, p.z - CELL.z) < NEAR
const spin = (rand: () => number) => new Quaternion().setFromAxisAngle(v(0, 1, 0), rand() * Math.PI * 2)

function places() {
  const rand = mulberry32(5)
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount
  const epidermis: Place[] = []
  const palisade: Place[] = []
  const plastids: Place[] = []
  const spongy: Place[] = []
  for (let x = -BLOCK.half + 0.5 * C; x < BLOCK.half; x += C) {
    for (let z = NOTCH.depth - 0.5 * C; z > -BLOCK.back; z -= C) {
      for (const y of [2.76 * C, -2.78 * C]) {
        const at = v(x + jitter(0.05 * C), y, z + jitter(0.05 * C))
        if (y < 0 && at.distanceTo(STOMA) < 0.9 * C) continue
        epidermis.push({ at, scale: v(0.6 * C, 0.24 * C, 0.6 * C).multiplyScalar(0.95 + 0.1 * rand()) })
      }
    }
  }
  for (let i = -11; i <= 11; i++) {
    for (let k = -7; k <= 3; k++) {
      const at = v(i * 0.9 * C, CELL.y + jitter(0.06 * C), (k + 0.5) * 0.9 * C)
      if (at.clone().setY(CELL.y).distanceTo(CELL) < 1e-9) continue
      const near = isNear(at)
      palisade.push({ at, scale: v(1, 1, 1), turn: spin(rand), near })
      for (let n = 0; n < (near ? 10 : 0); n++) {
        const a = rand() * Math.PI * 2
        const r = PALISADE.radius - 0.02 * C
        plastids.push({ at: at.clone().add(v(Math.cos(a) * r, jitter(0.7 * C), Math.sin(a) * r)), scale: v(0.1 * C, 0.17 * C, 0.1 * C) })
      }
    }
  }
  for (let x = -BLOCK.half + 0.6 * C; x < BLOCK.half; x += 1.2 * C) {
    for (let z = -BLOCK.back + 0.6 * C; z < NOTCH.depth; z += 1.2 * C) {
      for (const y of [-0.75 * C, -1.85 * C]) {
        const at = v(x + jitter(0.15 * C), y + jitter(0.12 * C), z + jitter(0.15 * C))
        if (rand() > 0.72) continue
        if (y < -C && at.clone().setY(STOMA.y).distanceTo(STOMA) < 1.4 * C) continue
        if (Math.hypot(at.x - VEIN.x, at.y - VEIN.y) < 1.15 * C && at.z < 0.4 * C) continue
        const scale = v(0.5 + 0.12 * rand(), 0.42 + 0.08 * rand(), 0.5 + 0.12 * rand()).multiplyScalar(C)
        const near = isNear(at)
        spongy.push({ at, scale, turn: spin(rand), near })
        for (let n = 0; n < (near ? 5 : 0); n++) {
          const dir = v(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize()
          plastids.push({ at: at.clone().add(dir.multiply(scale).multiplyScalar(0.9)), scale: v(0.1 * C, 0.1 * C, 0.1 * C) })
        }
      }
    }
  }
  return { epidermis, palisade, plastids, spongy }
}

function instanced(geometry: BufferGeometry, material: Material, list: Place[]) {
  const mesh = new InstancedMesh(geometry, material, list.length)
  const m = new Matrix4()
  const q = new Quaternion()
  list.forEach((p, i) => mesh.setMatrixAt(i, m.compose(p.at, p.turn ?? q, p.scale)))
  return mesh
}

function spots(base: string, count: number, size: [number, number]) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const g = canvas.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 256, 256)
  const tint = new Color(PLASTID)
  const under = new Color(base)
  g.fillStyle = tint.setRGB(tint.r / under.r, tint.g / under.g, tint.b / under.b).getStyle()
  const rand = mulberry32(count)
  for (let i = 0; i < count; i++) {
    const [x, y] = [rand() * 256, 40 + rand() * 176]
    for (const dx of [-256, 0, 256]) {
      g.beginPath()
      g.ellipse(x + dx, y, size[0], size[1], 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function vein() {
  const group = new Group()
  group.position.copy(VEIN).setZ(-BLOCK.back / 2)
  const length = BLOCK.back
  const sheath = new CapsuleGeometry(0.26 * C, length - 0.52 * C, 4, 12).rotateX(Math.PI / 2)
  const sheathMaterial = paint('#c3dc8e', { transparent: true })
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    group.add(new Mesh(sheath, sheathMaterial).translateX(Math.cos(a) * 0.62 * C).translateY(Math.sin(a) * 0.62 * C))
  }
  const xylem = new CylinderGeometry(0.15 * C, 0.15 * C, length, 14).rotateX(Math.PI / 2)
  const xylemMaterial = paint('#9fb3c2', { transparent: true })
  for (const x of [-0.2, 0.15]) group.add(new Mesh(xylem, xylemMaterial).translateX(x * C).translateY(0.15 * C))
  const phloem = new CylinderGeometry(0.08 * C, 0.08 * C, length, 10).rotateX(Math.PI / 2)
  const phloemMaterial = paint('#d9c88c', { transparent: true })
  for (const x of [-0.18, 0, 0.18]) group.add(new Mesh(phloem, phloemMaterial).translateX(x * C).translateY(-0.25 * C))
  return group
}

function stoma() {
  const geometry = new TorusGeometry(0.42 * C, 0.2 * C, 12, 20, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2).scale(1, 1, 1.3)
  const material = paint('#7fb85a', { transparent: true })
  const right = new Mesh(geometry, material)
  const left = new Mesh(geometry, material)
  left.rotation.y = Math.PI
  const group = new Group().add(left, right)
  group.position.copy(STOMA)
  return group
}

export function createTissue() {
  const all = places()
  const palisade = new CapsuleGeometry(PALISADE.radius, PALISADE.length, 3, 12)
  const spongy = new SphereGeometry(1, 12, 8)
  const SPONGY = '#b8d68a'
  const kinds = [
    { list: all.epidermis, geometry: new SphereGeometry(1, 12, 6), color: '#dfe9c4' },
    { list: all.plastids, geometry: new SphereGeometry(1, 10, 8), color: PLASTID },
    { list: all.palisade.filter((p) => p.near), geometry: new CapsuleGeometry(PALISADE.radius, PALISADE.length, 6, 16), color: PALISADE.color },
    { list: all.palisade.filter((p) => !p.near), geometry: palisade, color: PALISADE.color, map: spots(PALISADE.color, 12, [8, 15]) },
    { list: all.spongy.filter((p) => p.near), geometry: spongy, color: SPONGY },
    { list: all.spongy.filter((p) => !p.near), geometry: spongy, color: SPONGY, map: spots(SPONGY, 7, [7, 10]) },
  ]
  const region = (notch: boolean) => {
    const group = new Group()
    for (const { list, geometry, color, map } of kinds) {
      const material = paint(color, { transparent: true, ...(map && { map, emissiveMap: map }) })
      group.add(instanced(geometry, material, list.filter((p) => inNotch(p.at) === notch && (notch || p.at.z < NOTCH.depth - 0.7 * C))))
    }
    return group
  }
  const block = region(false).add(vein(), stoma())
  const plug = region(true)
  const point = (x: number, y: number, z: number) => {
    const o = new Object3D()
    o.position.set(x, y, z)
    block.add(o)
    return o
  }
  return {
    group: new Group().add(block, plug),
    labels: {
      palisade: point(-4.5 * C, 1.9 * C, 0.4 * C),
      spongy: point(1.8 * C, -1.2 * C, 0.6 * C),
      stoma: point(STOMA.x, STOMA.y - 0.2 * C, STOMA.z + 0.6 * C),
    },
    update(open: number) {
      const shown = smooth(open * 2)
      const out = smooth(open * 2 - 1)
      fade([block], shown)
      fade([plug], shown * (1 - out))
      plug.position.z = out * NOTCH.depth * 1.5
      return shown === 1
    },
  }
}
