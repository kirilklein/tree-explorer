import { BoxGeometry, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three'
import { SOIL_DEPTH, SOIL_HALF_SIZE } from './tree'

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

export function createGround(openWall: number) {
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
    stone.position.set(x === 'wall' ? openWall : x, y, z)
    stone.scale.set(size * 1.3, size * 0.8, size)
    stone.rotation.set(i, i * 2.1, i * 0.7)
    stone.castShadow = true
    ground.add(stone)
  })

  const stone = new Mesh(stoneGeometry, stoneMaterial)
  stone.position.set(openWall - 0.25, LAYERS[2][1] + 0.32, 3)
  stone.scale.set(0.52, 0.32, 0.4)
  stone.rotation.y = 0.3
  stone.castShadow = true
  stone.receiveShadow = true
  ground.add(stone)
  return { ground, setWalls, stone }
}
