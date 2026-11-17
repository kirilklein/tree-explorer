import { Group, type Material, MathUtils, Mesh, MeshStandardMaterial } from 'three'
import type { Pose } from '../../scene/camera'
import type { View } from '../types'
import { createBlock } from './block'
import { createCut, cutPlanes } from './cut'
import { FLOOR, HALF_ANGLE, surfaceOf, trunkFrame } from './frame'
import { LOOP } from './growth'
import { layersOf } from './layers'
import { sectionPoses } from './poses'
import { ringTextures } from './texture'
import { createTubes } from './tubes'

const view: View = {
  steps: [
    {
      title: 'A window into the trunk',
      text: [
        'The outer bark shields the tree from heat, cold, rain and insects.',
        'The phloem carries food from the leaves to the rest of the tree. The cambium, just inside the phloem, makes new wood and new bark.',
        'The sapwood carries water up from the roots, and the dead heartwood in the centre holds the tree up.',
        'Each light and dark pair of rings is one year of growth.',
      ],
    },
    {
      title: 'Where is the tree alive?',
      text: [
        'Glowing cells are alive; pale ones are dead.',
        'The phloem cells are alive, and the cambium cells keep dividing.',
        'In the sapwood, the cells that carry water are dead, but the parenchyma cells are alive. In the heartwood, every cell is dead.',
      ],
    },
    {
      title: 'How the trunk grows',
      text: [
        'The cambium cells divide. They form new wood on the inside and new phloem on the outside, so the trunk grows wider.',
        'The new water-carrying cells die as they mature.',
        'Over time, the phloem becomes part of the bark.',
      ],
    },
    {
      title: 'Water on its way up',
      text: [
        'These water-carrying cells are tracheids. Their thick walls contain lignin, a key part of wood.',
        'Water moves from one tracheid to the next through pits in the side walls.',
        'Water evaporates from the leaves, and this pulls the water up from the roots.',
      ],
    },
    {
      title: 'Sugar on its way down',
      text: [
        'In the phloem, sieve-tube cells sit end to end and form a long sieve tube.',
        'Sugars flow from one cell to the next through the holes in the sieve plates. Pressure pushes the sugar and water down toward the roots.',
        'The sieve-tube cells are alive, but they have lost their nucleus. The companion cells next to them give them energy.',
      ],
    },
  ],
  create(world) {
    const frame = trunkFrame(world.sites.trunk)
    const surface = surfaceOf(world.wood.geometry, frame)
    const radius = surface(frame.at(FLOOR), frame.n)
    const textures = ringTextures(radius)
    const cut = createCut(frame, surface, radius)
    const faces = new Mesh(
      cut.geometry,
      new MeshStandardMaterial({
        map: textures.map,
        emissive: '#d6f08c',
        emissiveMap: textures.glow,
        emissiveIntensity: 0.6,
        roughness: 0.85,
      }),
    )
    const block = createBlock(frame, surface, radius)
    const tubes = createTubes(frame, radius)
    const group = new Group().add(faces, ...block.meshes, tubes.group)

    const wood = world.wood.material as MeshStandardMaterial
    const before = { planes: wood.clippingPlanes, intersection: wood.clipIntersection }
    const clipping = cutPlanes(frame)
    wood.clippingPlanes = clipping.planes
    wood.clipIntersection = true
    world.setWind(0)

    const layers = layersOf(radius)
    const middle = (name: string) => {
      const layer = layers.find((l) => l.name === name)!
      return (layer.inner + layer.outer) / 2
    }
    let open = -1
    let growth = 0
    let pulse = 0

    return {
      group,
      poses: sectionPoses(frame, radius).map((p): Pose => ({ position: p.position.toArray(), target: p.target.toArray() })),
      labels: [
        { text: 'Outer bark', at: frame.point(-HALF_ANGLE, middle('Outer bark'), 0.13).toArray(), steps: [0] },
        { text: 'Phloem', at: frame.point(-HALF_ANGLE, middle('Phloem'), 0.04).toArray(), steps: [0] },
        { text: 'Cambium', at: frame.point(-HALF_ANGLE, middle('Cambium'), -0.05).toArray(), steps: [0] },
        { text: 'Sapwood', at: frame.point(0.15, middle('Sapwood'), FLOOR).toArray(), steps: [0] },
        { text: 'Heartwood', at: frame.point(0.3, 0.18, FLOOR).toArray(), steps: [0] },
        { text: 'Cambium', at: block.point(0, 6).toArray(), steps: [1, 2] },
        { text: 'Living parenchyma', at: block.point(-3, 5).toArray(), steps: [1] },
        { text: 'Dead water-carrying cell', at: block.point(-5, 6).toArray(), steps: [1] },
        { text: 'New wood', at: block.point(-2, 6).toArray(), steps: [2] },
        { text: 'New phloem', at: block.point(2, 6).toArray(), steps: [2] },
        { text: 'Tracheid', at: tubes.points.tracheid.toArray(), steps: [3] },
        { text: 'Pit', at: tubes.points.pit.toArray(), steps: [3] },
        { text: 'Water', at: tubes.points.water.toArray(), steps: [3] },
        { text: 'Sieve-tube cell', at: tubes.points.sieve.toArray(), steps: [4] },
        { text: 'Sieve plate', at: tubes.points.plate.toArray(), steps: [4] },
        { text: 'Companion cell', at: tubes.points.companion.toArray(), steps: [4] },
        { text: 'Sugar', at: tubes.points.sugar.toArray(), steps: [4] },
      ],
      update(dt, step, camera) {
        const next = MathUtils.smoothstep(2.15 - camera.position.distanceTo(world.sites.trunk.point), 0, 0.45)
        if (next !== open) {
          open = next
          cut.update(open)
          clipping.update(open)
          faces.visible = open > 0.001
        }
        pulse += dt
        if (step === 2) growth += dt
        else if (step > 2) growth = Math.min(Math.ceil(growth / LOOP - 1e-9) * LOOP, growth + dt * 3)
        const settled = growth % LOOP === 0
        const near = 1 - MathUtils.smoothstep(camera.position.distanceTo(block.center), 0.4, 0.75)
        block.update(growth, pulse, near * open)
        tubes.update(dt, [settled && step >= 3, settled && step >= 4], near * open)
      },
      dispose() {
        wood.clippingPlanes = before.planes
        wood.clipIntersection = before.intersection
        world.setWind(1)
        textures.map.dispose()
        textures.glow.dispose()
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
