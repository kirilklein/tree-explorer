import { ExtrudeGeometry, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial, Shape } from 'three'
import { SOIL_DEPTH, SOIL_HALF_SIZE } from './tree'

const LAYERS: [top: number, bottom: number, color: string, cut: boolean][] = [
  [0, -0.22, '#7fae5a', true],
  [-0.22, -1.1, '#5e4331', true],
  [-1.1, -2.2, '#7a5a3e', true],
  [-2.2, -3.0, '#a08060', true],
  [-3.0, -SOIL_DEPTH, '#a08060', false],
]

const STONES: [x: number, y: number, z: number, size: number][] = [
  [0, -1.5, 2.3, 0.42],
  [0, -2.7, 4.4, 0.5],
  [0, -0.8, 5.2, 0.3],
  [2.8, -1.9, 0, 0.48],
  [5.1, -1.0, 0, 0.34],
  [1.4, -2.0, 0, 0.36],
]

export function createGround(): Group {
  const s = SOIL_HALF_SIZE
  const shape = new Shape()
    .moveTo(-s, -s)
    .lineTo(0, -s)
    .lineTo(0, 0)
    .lineTo(s, 0)
    .lineTo(s, s)
    .lineTo(-s, s)
    .closePath()
  const square = new Shape().moveTo(-s, -s).lineTo(s, -s).lineTo(s, s).lineTo(-s, s).closePath()

  const ground = new Group()
  for (const [top, bottom, color, cut] of LAYERS) {
    const geometry = new ExtrudeGeometry(cut ? shape : square, { depth: top - bottom, bevelEnabled: false })
    geometry.rotateX(-Math.PI / 2)
    geometry.translate(0, bottom, 0)
    const layer = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: 1 }))
    layer.receiveShadow = true
    ground.add(layer)
  }

  const stoneGeometry = new IcosahedronGeometry(1, 2)
  const stoneMaterial = new MeshStandardMaterial({ color: '#9b9a94', roughness: 0.85 })
  STONES.forEach(([x, y, z, size], i) => {
    const stone = new Mesh(stoneGeometry, stoneMaterial)
    stone.position.set(x, y, z)
    stone.scale.set(size * 1.3, size * 0.8, size)
    stone.rotation.set(i, i * 2.1, i * 0.7)
    stone.castShadow = true
    ground.add(stone)
  })
  return ground
}
