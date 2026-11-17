import {
  Color,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three'
import { FLOOR, type Frame, type Surface } from './frame'
import { cellsAt, ROWS, WINDOW_INNER } from './growth'
import { CELL, layerNamed, layersOf } from './layers'

const HEIGHT = CELL * 0.45
const MAX_CELLS = 220
const JITTER = [0.05, -0.12, 0.08, 0, -0.07, 0.11, -0.04]

const COLORS = {
  sapwood: new Color('#f3e8cf'),
  heartwood: new Color('#d2a676'),
  living: new Color('#d9eab8'),
  bark: new Color('#8a5c3e'),
  glow: new Color('#c4f27e'),
  cambium: new Color('#fbffe6'),
  cambiumGlow: new Color('#f2f78c'),
  barkFill: new Color('#6b4430'),
}

function roundedSquare(half: number, corner: number) {
  const shape = new Shape()
  const c = half - corner
  shape.moveTo(-c, -half)
  shape.lineTo(c, -half)
  shape.quadraticCurveTo(half, -half, half, -c)
  shape.lineTo(half, c)
  shape.quadraticCurveTo(half, half, c, half)
  shape.lineTo(-c, half)
  shape.quadraticCurveTo(-half, half, -half, c)
  shape.lineTo(-half, -c)
  shape.quadraticCurveTo(-half, -half, -c, -half)
  return shape
}

const fading = <T extends MeshBasicMaterial | MeshStandardMaterial>(material: T) => {
  material.transparent = true
  material.opacity = 0
  return material
}

export function createBlock(frame: Frame, surface: Surface, radius: number) {
  const { n, a } = frame
  const across = new Vector3().crossVectors(n, a)
  const { inner, outer: rim } = layerNamed(layersOf(radius), 'Cambium')
  const cambium = (inner + rim) / 2
  const floor = frame.at(FLOOR)
  const origin = floor.clone().addScaledVector(n, cambium)
  const turn = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(n, a, across))
  const rowAt = (row: number) => (row - (ROWS - 1) / 2) * CELL
  const outer = Array.from({ length: ROWS }, (_, row) => {
    const start = floor.clone().addScaledVector(across, rowAt(row))
    return (surface(start, n) - cambium) / CELL - JITTER[row] - 0.02
  })
  const at = (x: number, row: number, up = 0) =>
    origin.clone().addScaledVector(n, (x + JITTER[row]) * CELL).addScaledVector(across, rowAt(row)).addScaledVector(a, up)

  const window = new Plane().setFromNormalAndCoplanarPoint(n, at(WINDOW_INNER, 3))
  const clip = { clippingPlanes: [window] }
  const shape = roundedSquare(0.5, 0.12)
  shape.holes.push(roundedSquare(0.36, 0.12))
  const walls = new InstancedMesh(
    new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 3 }).rotateX(-Math.PI / 2),
    fading(new MeshStandardMaterial({ roughness: 0.75, ...clip })),
    MAX_CELLS,
  )
  const cores = new InstancedMesh(
    new SphereGeometry(0.5, 14, 8),
    fading(new MeshBasicMaterial({ toneMapped: false, ...clip })),
    MAX_CELLS,
  )
  const left = WINDOW_INNER - 0.5
  const right = Math.min(...outer)
  const base = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fading(new MeshBasicMaterial({ color: '#22150d', ...clip })))
  base.position.copy(origin).addScaledVector(n, ((left + right) / 2) * CELL).addScaledVector(a, 0.0002)
  base.quaternion.copy(turn)
  base.scale.set((right - left) * CELL, 1, ROWS * CELL)

  const m = new Matrix4()
  const size = new Vector3()
  const color = new Color()
  const glow = new Color()

  function update(time: number, pulse: number, opacity: number) {
    for (const mesh of [walls, cores, base]) {
      mesh.material.opacity = opacity
      mesh.visible = opacity > 0.01
    }
    if (!base.visible) return
    const cells = cellsAt(time, outer)
    cells.forEach((cell, i) => {
      const width = cell.outer - cell.inner
      const center = at((cell.inner + cell.outer) / 2, cell.row)
      const shrink = Math.min(1, width / 0.3)
      walls.setMatrixAt(i, m.compose(center, turn, size.set(width * CELL * 0.97, HEIGHT * shrink, CELL * 0.92)))
      const dividing = cell.kind === 'cambium'
      const wall = dividing ? COLORS.cambium : cell.kind === 'phloem' ? COLORS.living : COLORS.sapwood
      color.copy(wall).lerp(COLORS.heartwood, cell.heartwood).lerp(COLORS.bark, cell.bark)
      walls.setColorAt(i, color)
      const fill = Math.max(cell.alive, cell.bark)
      const beat = 0.82 + 0.18 * Math.sin(pulse * 1.7 + cell.id * 2.399)
      glow.copy(dividing ? COLORS.cambiumGlow : COLORS.glow).multiplyScalar(beat).lerp(COLORS.barkFill, cell.bark)
      cores.setColorAt(i, glow)
      const core = Math.sqrt(fill) * shrink
      cores.setMatrixAt(
        i,
        m.compose(at((cell.inner + cell.outer) / 2, cell.row, HEIGHT * 0.4), turn, size.set(width * CELL * 0.7 * core, HEIGHT * 0.8 * core, CELL * 0.66 * core)),
      )
    })
    for (const mesh of [walls, cores]) {
      mesh.count = cells.length
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
    }
  }

  const point = (x: number, row: number) => at(x, row, HEIGHT)
  return { meshes: [base, walls, cores], update, point, outer, center: at(-2.5, 3) }
}
