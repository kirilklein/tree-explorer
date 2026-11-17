import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { generateTree } from '../tree'
import { leafSite } from './leaf'
import { trunkSite } from './trunk'

const tree = generateTree()

describe('leaf site', () => {
  const leaf = leafSite(tree)

  it('is deterministic', () => {
    expect(leafSite(generateTree()).index).toBe(leaf.index)
  })

  it('picks a leaf high above ground at the crown edge facing the default camera', () => {
    expect(tree.leaves[leaf.index].position).toBe(leaf.position)
    expect(leaf.center.y).toBeGreaterThan(3)
    const crown = tree.leaves.reduce((sum, l) => sum.add(l.position), new Vector3()).divideScalar(tree.leaves.length)
    const toward = leaf.shot.arrival.position.clone().sub(crown).setY(0).normalize()
    const out = (p: Vector3) => p.clone().sub(crown).dot(toward)
    const further = tree.leaves.filter((l) => out(l.position) > out(leaf.position)).length
    expect(further / tree.leaves.length).toBeLessThan(0.05)
    expect(leaf.normal.length()).toBeCloseTo(1, 9)
  })
})

describe('trunk site', () => {
  const trunk = trunkSite(tree)

  it('is deterministic', () => {
    expect(trunkSite(generateTree()).point.toArray()).toEqual(trunk.point.toArray())
  })

  it('lies on the trunk surface with a unit outward normal across the axis', () => {
    expect(trunk.normal.length()).toBeCloseTo(1, 9)
    expect(trunk.axis.length()).toBeCloseTo(1, 9)
    expect(Math.abs(trunk.normal.dot(trunk.axis))).toBeLessThan(0.05)
    const seg = tree.branches.filter((b) => b.depth === 0).find((s) => s.start.y <= trunk.point.y && s.end.y >= trunk.point.y)!
    const t = (trunk.point.y - seg.start.y) / (seg.end.y - seg.start.y)
    const center = seg.start.clone().lerp(seg.end, t)
    expect(trunk.point.distanceTo(center)).toBeCloseTo(trunk.radius, 2)
    expect(trunk.point.x).toBeGreaterThan(0)
    expect(trunk.point.z).toBeGreaterThan(0)
  })
})
