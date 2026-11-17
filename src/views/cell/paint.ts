import { type Material, Mesh, MeshStandardMaterial, type MeshStandardMaterialParameters, type Object3D } from 'three'

export const paint = (color: string, options: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.7, ...options })

export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

export function fade(objects: Object3D[], opacity: number) {
  for (const object of objects) {
    object.visible = opacity > 0.005
    object.traverse((o) => {
      if (o instanceof Mesh) (o.material as Material).opacity = opacity * ((o.material as Material).userData.opacity ?? 1)
    })
  }
}

export function free(root: Object3D) {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose()
      const material = o.material as MeshStandardMaterial
      material.map?.dispose()
      material.dispose()
    }
  })
}
