import { BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { View } from '../types'

const view: View = {
  steps: [{ title: 'Trunk cross-section', text: ['A placeholder for this view.'] }],
  create({ sites: { trunk } }) {
    const mesh = new Mesh(new BoxGeometry(0.06, 0.06, 0.06), new MeshStandardMaterial({ color: '#c79a6b', roughness: 0.8 }))
    mesh.position.copy(trunk.point)
    const camera = trunk.point.clone().addScaledVector(trunk.normal, 0.9).add(new Vector3(0, 0.1, 0))
    return {
      group: mesh,
      poses: [{ position: camera.toArray(), target: trunk.point.toArray() }],
      labels: [{ text: 'Bark', at: trunk.point.toArray() }],
      update() {},
      dispose() {
        mesh.geometry.dispose()
        mesh.material.dispose()
      },
    }
  },
}

export default view
