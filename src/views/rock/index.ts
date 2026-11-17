import { Group, type Material, Mesh } from 'three'
import type { Pose } from '../../scene/camera'
import type { View } from '../types'
import { createHyphae } from './hyphae'
import { createParticles } from './particles'
import { rockPoses } from './poses'
import { createTip } from './tip'

const view: View = {
  anchored: true,
  steps: [
    {
      title: 'A root tip and its root hairs',
      text: [
        'The tip of a root is protected by a root cap as it pushes through the soil.',
        "Behind it, root hairs grow from the outer cells and increase the root's surface area for taking up water and minerals.",
        'The soil right around the roots can run low in nutrients, so most plants rely on fungi.',
      ],
    },
    {
      title: 'The fungal partner',
      text: [
        'Most plants live with fungal partners on their roots, called mycorrhizae.',
        'On pines and other forest trees, the fungus wraps the root tip in a sheath, the mantle.',
        'Thread-like hyphae spread far beyond the root hairs. They are much finer than roots, and some grow onto grains of rock.',
      ],
    },
    {
      title: 'Dissolving rock',
      text: [
        'In one lab study, Scots pine seedlings grew with a fungus whose threads alone could reach grains of rock.',
        'The threads released oxalate, an organic acid, and calcium dissolved out of the grains. Much of it formed calcium oxalate crystals on the threads.',
        'How much depended on the rock: least on quartz and granite, most on gabbro.',
        'Shown sped up: the experiment ran for three to four months.',
      ],
    },
    {
      title: 'The trade',
      text: [
        'Sugars made in the leaves travel down through the root to the fungus.',
        'In return, the threads bring the tree minerals such as phosphorus.',
        "In the pine study, the fungus sent more of the tree's sugar to grains rich in calcium and magnesium than to quartz.",
      ],
    },
  ],
  create(site) {
    const tip = createTip(site)
    const fungus = createHyphae(site)
    const particles = createParticles(fungus.featured, fungus.contact, fungus.normal)
    const byStep = [
      [tip.cap, tip.hairs, tip.grains],
      [tip.mantle, fungus.hyphae],
      particles.contactParts,
      particles.streamParts,
    ]
    const group = new Group().add(...byStep.flat())
    const shown = byStep.map(() => 0)
    return {
      group,
      poses: rockPoses(site, fungus.featured, fungus.contact, fungus.normal).map(
        (p): Pose => ({ position: p.position.toArray(), target: p.target.toArray() }),
      ),
      labels: [
        { text: 'Root cap', at: tip.capPoint.toArray(), steps: [0] },
        { text: 'Root hairs', at: tip.hairPoint.toArray(), steps: [0] },
        { text: 'Fungal sheath', at: tip.mantlePoint.toArray(), steps: [1] },
        { text: 'Hyphae', at: fungus.hyphaPoint.toArray(), steps: [1] },
        { text: 'Stone', at: fungus.stonePoint.toArray(), steps: [1] },
        { text: 'Oxalate', at: particles.oxalatePoint.toArray(), steps: [2] },
        { text: 'Calcium oxalate crystals', at: particles.crystalPoint.toArray(), steps: [2] },
        { text: 'Minerals', at: particles.mineralPoint.toArray(), steps: [3] },
        { text: 'Sugars', at: particles.sugarPoint.toArray(), steps: [3] },
      ],
      update(dt, step, camera) {
        particles.update(dt)
        const near = 1 - Math.min(1, Math.max(0, (camera.position.distanceTo(site.tip) - 0.9) / 1.1))
        byStep.forEach((meshes, i) => {
          const wanted = i === 0 ? 1 : i === 1 ? Number(step >= 1) : Number(step === i)
          shown[i] += (wanted - shown[i]) * Math.min(1, dt * 2.5)
          for (const mesh of meshes) {
            const material = mesh.material as Material
            material.opacity = material.userData.opacity * shown[i] * near
            mesh.visible = material.opacity > 0.01
          }
        })
      },
      dispose() {
        group.traverse((object) => {
          if (object instanceof Mesh) {
            object.geometry.dispose()
            ;(object.material as Material).dispose()
          }
        })
      },
    }
  },
}

export default view
