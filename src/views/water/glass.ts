import type { Material, Mesh } from 'three'
import type { World } from '../types'

const PARTS = [
  ['wood', 0.28, 1],
  ['roots', 0.35, 1],
  ['featuredRoot', 0.35, 1],
  ['leaves', 0.42, 2],
] as const

/** Turns the tree see-through; `set(0)` looks exactly like the tree it found. */
export function seeThrough(world: World) {
  const parts = PARTS.map(([key, opacity, order]) => {
    const mesh: Mesh = world[key]
    const material = mesh.material as Material
    const saved = { transparent: material.transparent, opacity: material.opacity, renderOrder: mesh.renderOrder }
    material.transparent = true
    material.needsUpdate = true
    mesh.renderOrder = order
    return { mesh, material, opacity, saved }
  })
  return {
    set(amount: number) {
      for (const { material, opacity, saved } of parts) material.opacity = saved.opacity + (opacity - saved.opacity) * amount
    },
    restore() {
      for (const { mesh, material, saved } of parts) {
        material.transparent = saved.transparent
        material.opacity = saved.opacity
        material.needsUpdate = true
        mesh.renderOrder = saved.renderOrder
      }
    },
  }
}
