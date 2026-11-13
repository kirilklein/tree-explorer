import { Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Water transport', text: ['A placeholder for this view.'] }],
  create() {
    const mesh = new Mesh(new SphereGeometry(1, 48, 32), new MeshStandardMaterial({ color: '#8cc3e0', roughness: 0.8 }))
    return {
      group: mesh,
      poses: [{ position: [3, 2, 5], target: [0, 0, 0] }],
      labels: [{ text: 'Water', at: [0, 1.2, 0] }],
      update(dt) {
        mesh.rotation.y += dt * 0.3
      },
      dispose() {
        mesh.geometry.dispose()
        mesh.material.dispose()
      },
    }
  },
}

export default view
