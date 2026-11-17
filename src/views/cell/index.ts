import { Group, Matrix4, Plane, Vector3 } from 'three'
import type { Pose } from '../../scene/camera'
import type { View } from '../types'
import { createBlade } from './blade'
import { createCell } from './cell'
import { NOTCH, THICKNESS } from './frame'
import { free, smooth } from './paint'
import { leafPlan } from './poses'
import { createStreams } from './streams'
import { swayMatrix } from './sway'
import { createTissue } from './tissue'

const ramp = (value: number, from: number, to: number) => smooth((from - value) / (from - to))
const ease = (value: number, goal: number, dt: number, seconds: number) =>
  value + Math.max(-dt / seconds, Math.min(dt / seconds, goal - value))

const view: View = {
  steps: [
    {
      title: 'One leaf',
      text: [
        'The widest part of a leaf is its blade, the lamina. A stalk, the petiole, attaches it to the stem.',
        'A midrib runs the length of the leaf and branches to each side into veins.',
        'The veins bring in water and minerals and carry the products of photosynthesis to the rest of the tree.',
      ],
    },
    {
      title: 'Inside the blade',
      text: [
        'The epidermis, usually one layer of cells, covers both sides of the leaf.',
        'Under the upper side stand tightly packed, column-shaped palisade cells. Below them, loosely arranged spongy cells leave air spaces.',
        'Both layers hold many chloroplasts.',
        'Gases pass through stomata, pores in the lower epidermis. Two guard cells open and close each one.',
      ],
    },
    {
      title: 'One living cell',
      text: [
        'A palisade cell, taken apart. Animal cells have no cell wall, chloroplasts or central vacuole.',
        'Cell wall: protects the cell and gives it shape.',
        'Plasma membrane: controls what passes in and out.',
        'Chloroplasts: carry out photosynthesis.',
        "Central vacuole: most of the cell's volume; regulates its water.",
        "Nucleus: holds the cell's DNA.",
        "Mitochondria: make ATP, the cell's main energy carrier.",
      ],
    },
    {
      title: 'The chloroplast',
      text: [
        'Inside its double envelope are stacks of disc-shaped thylakoids.',
        'Light, carbon dioxide and water go in. Sugar and oxygen come out.',
        'Yellow: light. Grey: carbon dioxide. Blue: water. Orange: sugar. Red: oxygen.',
        "Carbon taken from the air makes up most of a tree's dry mass.",
      ],
    },
  ],
  create(world) {
    const { leaf } = world.sites
    const tree = world.tree.leaves[leaf.index]
    const phase = (leaf.index * 2.399) % (Math.PI * 2)
    const plan = leafPlan(leaf, world.leaves.geometry)
    const notch = [new Plane(new Vector3(1, 0, 0), -NOTCH.half), new Plane(new Vector3(-1, 0, 0), -NOTCH.half), new Plane(new Vector3(0, 0, -1))]
    const cut = notch.map(() => new Plane())

    const blade = createBlade(world.leaves, leaf.index, cut, THICKNESS / 2 / leaf.scale)
    const tissue = createTissue()
    const cell = createCell(plan)
    const streams = createStreams(plan)
    const section = new Group().add(tissue.group, cell.group, streams.group)
    plan.local.decompose(section.position, section.quaternion, section.scale)
    const root = new Group().add(blade.group, section)
    root.matrixAutoUpdate = false
    const sectionPoint = new Vector3().setFromMatrixPosition(plan.rest)

    const saved = new Matrix4()
    world.leaves.getMatrixAt(leaf.index, saved)
    let hidden = false
    const hide = (value: boolean) => {
      if (value === hidden) return
      hidden = value
      world.leaves.setMatrixAt(leaf.index, value ? new Matrix4().makeScale(0, 0, 0) : saved)
      world.leaves.instanceMatrix.needsUpdate = true
    }
    world.setWind(0)

    let first = true
    let apart = 0
    let open = 0
    let detail = 0
    return {
      group: root,
      poses: plan.poses.map((p): Pose => ({ position: p.position.toArray(), target: p.target.toArray() })),
      labels: [
        { text: 'Midrib', at: blade.labels.midrib, steps: [0] },
        { text: 'Vein', at: blade.labels.vein, steps: [0] },
        { text: 'Leaf stalk', at: blade.labels.stalk, steps: [0] },
        { text: 'Palisade layer', at: tissue.labels.palisade, steps: [1] },
        { text: 'Spongy layer', at: tissue.labels.spongy, steps: [1] },
        { text: 'Stoma', at: tissue.labels.stoma, steps: [1] },
        { text: 'Cell wall', at: cell.labels.wall, steps: [2] },
        { text: 'Plasma membrane', at: cell.labels.membrane, steps: [2] },
        { text: 'Chloroplasts', at: cell.labels.chloroplasts, steps: [2] },
        { text: 'Central vacuole', at: cell.labels.vacuole, steps: [2] },
        { text: 'Nucleus', at: cell.labels.nucleus, steps: [2] },
        { text: 'Mitochondria', at: cell.labels.mitochondria, steps: [2] },
        { text: 'Envelope', at: cell.labels.envelope, steps: [3] },
        { text: 'Thylakoid stacks', at: cell.labels.stacks, steps: [3] },
      ],
      update(dt, step, camera) {
        const wantApart = Number(step >= 2)
        const wantOpen = Number(step >= 3)
        apart = first ? wantApart : ease(apart, wantApart, dt, 2.4)
        open = first ? wantOpen : ease(open, wantOpen, dt, 2)
        const near = camera.position.distanceTo(leaf.center)
        const wantDetail = ramp(near, 2.15, 1.1)
        detail = first ? wantDetail : ease(detail, wantDetail, dt, 1.2)
        first &&= step < 0

        swayMatrix(tree, phase, root.matrix, 1 - ramp(near, 1.5, 0.5))
        root.matrixWorldNeedsUpdate = true
        hide(blade.update(detail))
        const cutting = tissue.update(ramp(camera.position.distanceTo(sectionPoint), 0.3, 0.05))
        notch[2].constant = cutting ? 0 : 1
        cell.update(apart, open)
        streams.update(dt, smooth(open))
        root.updateMatrixWorld(true)
        notch.forEach((plane, i) => cut[i].copy(plane).applyMatrix4(section.matrixWorld))
        cell.clip()
      },
      dispose() {
        hide(false)
        world.setWind(1)
        free(root)
      },
    }
  },
}

export default view
