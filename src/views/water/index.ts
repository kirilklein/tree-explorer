import { Group, type Material, Mesh, Vector3 } from 'three'
import type { Pose } from '../../scene/camera'
import type { View } from '../types'
import { seeThrough } from './glass'
import { createNetwork, newSample, sample } from './paths'
import { transportPoses } from './poses'
import { createStreams, SUGAR_DEPTH, WATER_DEPTH } from './streams'

const CALM = 0.15

const view: View = {
  steps: [
    {
      title: 'The puzzle',
      text: [
        'Coast redwoods grow to nearly 116 metres, and water still reaches their highest leaves.',
        'Gravity pulls on that water the whole way up.',
        'Yet lifting it costs the tree no metabolic energy. The pull starts at the top.',
      ],
    },
    {
      title: 'At the leaf: the pull starts here',
      text: [
        'Inside the leaf, water evaporates from wet cell walls into air spaces.',
        'The vapour escapes through pores called stomata. This loss is transpiration.',
        'The evaporation creates tension that pulls on the water in the xylem.',
      ],
    },
    {
      title: 'In the wood: one unbroken column',
      text: [
        'Water molecules hold on to each other (cohesion) and to the walls of the xylem (adhesion).',
        'So the water forms one continuous stream from the base to the top, and the pull lifts all of it.',
        'This is the cohesion–tension theory.',
      ],
    },
    {
      title: 'At the roots: water enters',
      text: [
        'Root cells hold many dissolved substances, so water moves into them from the soil by osmosis.',
        'It enters through the root hairs and replaces the water lost from the leaves.',
        'Up to 90 percent of the water the roots take up may be lost through transpiration.',
      ],
    },
    {
      title: 'Sugar, the other way',
      text: [
        'Leaves make sugars, such as sucrose, by photosynthesis.',
        'The phloem carries them to where they are used or stored. This is called translocation.',
        'Lower leaves send sugar down to the roots. Water in the xylem only moves one way: from soil to leaf to air.',
      ],
    },
  ],
  create(world) {
    const network = createNetwork(world.tree)
    const { poses, crown, roots } = transportPoses(world.tree, network)
    const streams = createStreams(world.tree, network, crown, roots)
    const glass = seeThrough(world)
    world.setWind(CALM)

    const trunk = network.path(0, 0)
    const facing = (s: number, depth: number, camera: Vector3) => {
      const at = newSample()
      let best = new Vector3()
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 32) {
        const p = sample(trunk, s, depth, a, at).position
        if (p.distanceToSquared(camera) < best.distanceToSquared(camera) || best.lengthSq() === 0) best = p.clone()
      }
      return best.toArray()
    }

    const shown = { glass: 0, water: 0, vapour: 0, threads: 0, soil: 0, sugar: 0 }
    return {
      group: new Group().add(...streams.parts),
      path: 'around',
      poses: poses.map((p): Pose => ({ position: p.position.toArray(), target: p.target.toArray() })),
      labels: [
        { text: 'Water rising', at: facing(1.2, WATER_DEPTH, poses[0].position), steps: [0] },
        { text: 'Leaves', at: streams.leafPoint.toArray(), steps: [1] },
        { text: 'Water vapour', at: streams.vapourPoint.toArray(), steps: [1] },
        { text: 'Xylem: water', at: facing(1.5, WATER_DEPTH, poses[2].position), steps: [2] },
        { text: 'Xylem: water', at: facing(2.6, WATER_DEPTH, poses[4].position), steps: [4] },
        { text: 'Fine roots', at: streams.rootPoint.toArray(), steps: [3] },
        { text: 'Water in the soil', at: streams.soilPoint.toArray(), steps: [3] },
        { text: 'Phloem: sugar', at: facing(0.9, SUGAR_DEPTH, poses[4].position), steps: [4] },
      ],
      update(dt, step, camera) {
        const on = location.hash.startsWith('#/water') ? 1 : 0
        const wanted = {
          glass: on,
          water: on,
          vapour: on * Number(step >= 1),
          threads: on * Number(step >= 2),
          soil: on * Number(step >= 3),
          sugar: on * Number(step >= 4),
        }
        for (const key of Object.keys(shown) as (keyof typeof shown)[]) {
          shown[key] += (wanted[key] - shown[key]) * Math.min(1, dt * 1.8)
          if (Math.abs(wanted[key] - shown[key]) < 1e-3) shown[key] = wanted[key]
        }
        glass.set(shown.glass)
        streams.update(dt, shown, Math.min(1.7, Math.max(1, camera.position.distanceTo(poses[0].target) / 12)))
      },
      dispose() {
        glass.restore()
        world.setWind(1)
        for (const part of streams.parts) {
          part.geometry.dispose()
          ;(part.material as Material).dispose()
          if (part instanceof Mesh) part.customDepthMaterial?.dispose()
        }
      },
    }
  },
}

export default view
