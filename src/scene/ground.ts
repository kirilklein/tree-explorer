import { BoxGeometry, Group, IcosahedronGeometry, Line3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { type Segment, SOIL_DEPTH, SOIL_HALF_SIZE } from './tree'

const LAYERS: [top: number, bottom: number, color: string, cut: boolean][] = [
  [0, -0.22, '#7fae5a', true],
  [-0.22, -1.1, '#5e4331', true],
  [-1.1, -2.2, '#7a5a3e', true],
  [-2.2, -3.0, '#a08060', true],
  [-3.0, -SOIL_DEPTH, '#a08060', false],
]

const STONES: [x: number | 'wall', y: number, z: number, size: number][] = [
  ['wall', -2.7, 4.4, 0.5],
  ['wall', -2.55, 5.5, 0.3],
  [2.8, -1.9, 0, 0.48],
  [5.1, -1.0, 0, 0.34],
  [1.4, -2.0, 0, 0.36],
]

/** The nearest place along the stone's wall where no root runs through it. */
function clearOf(roots: Segment[], at: Vector3, size: number, along: 'x' | 'z') {
  const near = new Vector3()
  const free = (p: Vector3) =>
    roots.every((r) => new Line3(r.start, r.end).closestPointToPoint(p, true, near).distanceTo(p) > size * 1.3 + r.startRadius)
  for (let k = 0; k < 24; k++) {
    const p = at.clone()
    p[along] += Math.ceil(k / 2) * 0.3 * (k % 2 ? 1 : -1)
    if (free(p)) return p
  }
  return at
}

export function createGround(openWall: number, stoneAt: Vector3, stoneTurn: number, roots: Segment[] = []) {
  const s = SOIL_HALF_SIZE
  const box = new BoxGeometry()
  const ground = new Group()
  const walls: Mesh[][] = []
  for (const [top, bottom, color, cut] of LAYERS) {
    const material = new MeshStandardMaterial({ color, roughness: 1 })
    const parts = cut ? [new Mesh(box, material), new Mesh(box, material)] : [new Mesh(box, material)]
    for (const part of parts) {
      part.scale.set(2 * s, top - bottom, 2 * s)
      part.position.y = (top + bottom) / 2
      part.receiveShadow = true
      ground.add(part)
    }
    if (cut) walls.push(parts)
  }

  function setWalls(xs: number[]) {
    walls.forEach(([a, b], i) => {
      a.scale.x = xs[i] + s
      a.position.x = (xs[i] - s) / 2
      b.scale.x = s - xs[i]
      b.scale.z = s
      b.position.set((xs[i] + s) / 2, b.position.y, -s / 2)
    })
  }
  setWalls(walls.map(() => 0))

  const stoneGeometry = new IcosahedronGeometry(1, 2)
  const stoneMaterial = new MeshStandardMaterial({ color: '#9b9a94', roughness: 0.85 })
  STONES.forEach(([x, y, z, size], i) => {
    const stone = new Mesh(stoneGeometry, stoneMaterial)
    stone.position.copy(clearOf(roots, new Vector3(x === 'wall' ? openWall : x, y, z), size, x === 'wall' ? 'z' : 'x'))
    stone.scale.set(size * 1.3, size * 0.8, size)
    stone.rotation.set(i, i * 2.1, i * 0.7)
    stone.castShadow = true
    ground.add(stone)
  })

  const stone = new Mesh(stoneGeometry, stoneMaterial)
  stone.position.copy(stoneAt)
  stone.scale.set(0.52, 0.32, 0.4)
  stone.rotation.y = stoneTurn
  stone.castShadow = true
  stone.receiveShadow = true
  ground.add(stone)
  return { ground, setWalls, stone }
}
