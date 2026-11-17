import { DodecahedronGeometry, Mesh, MeshStandardMaterial } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Roots and rock', text: ['A placeholder for this view.'] }],
  create() {
    const mesh = new Mesh(new DodecahedronGeometry(1, 1), new MeshStandardMaterial({ color: '#a3a199', roughness: 0.8 }))
    return {
      group: mesh,
      poses: [{ position: [3, 2, 5], target: [0, 0, 0] }],
      labels: [{ text: 'Mineral grain', at: [0, 1.2, 0] }],
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
