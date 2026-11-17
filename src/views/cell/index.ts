import { Mesh, MeshStandardMaterial, SphereGeometry } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Inside a leaf', text: ['A placeholder for this view.'] }],
  create({ sites: { leaf } }) {
    const mesh = new Mesh(new SphereGeometry(0.02, 24, 16), new MeshStandardMaterial({ color: '#7fc46a', roughness: 0.6 }))
    mesh.position.copy(leaf.center).addScaledVector(leaf.normal, 0.01)
    const from = leaf.shot.arrival.position.clone().sub(leaf.center).normalize()
    return {
      group: mesh,
      poses: [{ position: leaf.center.clone().addScaledVector(from, 0.6).toArray(), target: leaf.center.toArray() }],
      labels: [{ text: 'Leaf', at: mesh.position.toArray() }],
      update() {},
      dispose() {
        mesh.geometry.dispose()
        mesh.material.dispose()
      },
    }
  },
}

export default view
