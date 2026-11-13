import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { Segment, Tree } from './tree'
import { addWind } from './wind'

const RADIAL = 10

function chains(segments: Segment[]): Segment[][] {
  const result: Segment[][] = []
  for (const seg of segments) {
    const last = result.at(-1)?.at(-1)
    if (last && last.end === seg.start && last.depth === seg.depth) result.at(-1)!.push(seg)
    else result.push([seg])
  }
  return result
}

function woodGeometry(segments: Segment[]): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const sway: number[] = []
  const indices: number[] = []
  const normal = new Vector3()
  const binormal = new Vector3()
  const tangent = new Vector3()
  const radial = new Vector3()

  for (const chain of chains(segments)) {
    const points = [chain[0].start, ...chain.map((s) => s.end)]
    const radii = [chain[0].startRadius, ...chain.map((s) => s.endRadius)]
    const sways = [chain[0].startSway, ...chain.map((s) => s.endSway)]
    const base = positions.length / 3

    tangent.subVectors(points[1], points[0]).normalize()
    normal.set(0, 0, 1).cross(tangent)
    if (normal.lengthSq() < 1e-4) normal.set(1, 0, 0).cross(tangent)
    normal.normalize()

    points.forEach((p, i) => {
      const before = points[Math.max(0, i - 1)]
      const after = points[Math.min(points.length - 1, i + 1)]
      tangent.subVectors(after, before).normalize()
      normal.addScaledVector(tangent, -normal.dot(tangent)).normalize()
      binormal.crossVectors(tangent, normal)
      for (let k = 0; k < RADIAL; k++) {
        const a = (k / RADIAL) * Math.PI * 2
        radial.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a))
        positions.push(p.x + radial.x * radii[i], p.y + radial.y * radii[i], p.z + radial.z * radii[i])
        normals.push(radial.x, radial.y, radial.z)
        sway.push(sways[i])
      }
    })

    for (let i = 0; i < points.length - 1; i++) {
      for (let k = 0; k < RADIAL; k++) {
        const a = base + i * RADIAL + k
        const b = base + i * RADIAL + ((k + 1) % RADIAL)
        indices.push(a, b, a + RADIAL, b, b + RADIAL, a + RADIAL)
      }
    }

    for (const [i, flip] of [[0, true], [points.length - 1, false]] as const) {
      const center = positions.length / 3
      tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize()
      if (flip) tangent.negate()
      positions.push(points[i].x, points[i].y, points[i].z)
      normals.push(tangent.x, tangent.y, tangent.z)
      sway.push(sways[i])
      for (let k = 0; k < RADIAL; k++) {
        const a = base + i * RADIAL + k
        const b = base + i * RADIAL + ((k + 1) % RADIAL)
        indices.push(...(flip ? [center, b, a] : [center, a, b]))
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aSway', new Float32BufferAttribute(sway, 1))
  geometry.setIndex(indices)
  return geometry
}

function leafGeometry(): BufferGeometry {
  const rows = 8
  const cols = 4
  const positions: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rows; r++) {
    const t = r / rows
    const width = 0.32 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75)
    for (let c = 0; c <= cols; c++) {
      const u = (c / cols) * 2 - 1
      positions.push(u * width, t, 0.18 * u * u * width + 0.12 * t * t)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c
      const b = a + cols + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function createTreeMeshes(tree: Tree) {
  const wood = new Mesh(woodGeometry(tree.branches), new MeshStandardMaterial({ color: '#7b5b45', roughness: 0.9 }))
  addWind(wood, false)

  const roots = new Mesh(woodGeometry(tree.roots), new MeshStandardMaterial({ color: '#9a7656', roughness: 0.95 }))

  const geometry = leafGeometry()
  const count = tree.leaves.length
  geometry.setAttribute('aSway', new InstancedBufferAttribute(new Float32Array(tree.leaves.map((l) => l.sway)), 1))
  geometry.setAttribute(
    'aPhase',
    new InstancedBufferAttribute(new Float32Array(tree.leaves.map((_, i) => (i * 2.399) % (Math.PI * 2))), 1),
  )
  const leaves = new InstancedMesh(
    geometry,
    new MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: DoubleSide }),
    count,
  )
  const matrix = new Matrix4()
  const color = new Color()
  const scale = new Vector3()
  tree.leaves.forEach((leaf, i) => {
    leaves.setMatrixAt(i, matrix.compose(leaf.position, leaf.quaternion, scale.setScalar(leaf.scale)))
    const lightness = 0.3 + 0.12 * Math.min(1, leaf.position.y / 12) + ((i * 0.618) % 1) * 0.08
    leaves.setColorAt(i, color.setHSL(0.25 + ((i * 0.381) % 1) * 0.05, 0.5, lightness))
  })
  addWind(leaves, true)

  for (const mesh of [wood, roots, leaves]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  leaves.receiveShadow = false
  return { wood, roots, leaves }
}
