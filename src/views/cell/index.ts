import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Leaf cell', text: ['A placeholder for this view.'] }],
  create() {
    const mesh = new Mesh(new BoxGeometry(1.6, 1, 1), new MeshStandardMaterial({ color: '#86b86a', roughness: 0.8 }))
    return {
      group: mesh,
      poses: [{ position: [3, 2, 5], target: [0, 0, 0] }],
      labels: [{ text: 'Cell wall', at: [0, 1.2, 0] }],
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
