import { Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Water transport', text: ['A placeholder for this view.'] }],
  create({ sites: { trunk } }) {
    const mesh = new Mesh(new SphereGeometry(0.12, 24, 16), new MeshStandardMaterial({ color: '#8cc3e0', roughness: 0.4 }))
    mesh.position.copy(trunk.point).addScaledVector(trunk.normal, 0.15)
    return {
      group: mesh,
      path: 'around',
      poses: [{ position: [-13, 7, 22], target: [0, 3.5, 0] }],
      labels: [{ text: 'Water', at: mesh.position.toArray() }],
      update() {},
      dispose() {
        mesh.geometry.dispose()
        mesh.material.dispose()
      },
    }
  },
}

export default view
