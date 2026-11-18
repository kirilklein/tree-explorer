import { Line3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { featuredRoot } from './sites/root'
import { generateTree, MAX_LEAVES, STALK } from './tree'

describe('generateTree', () => {
  const tree = generateTree(7)

  it('is deterministic for a seed', () => {
    expect(generateTree(7)).toEqual(tree)
  })

  it('differs between seeds', () => {
    expect(generateTree(8)).not.toEqual(tree)
  })

  it('has sensible sizes', () => {
    expect(tree.branches.length).toBeGreaterThan(200)
    expect(tree.branches.length).toBeLessThan(3000)
    expect(tree.roots.length).toBeGreaterThan(30)
    expect(tree.roots.length).toBeLessThan(3000)
    expect(tree.leaves.length).toBeGreaterThan(1000)
    expect(tree.leaves.length).toBeLessThanOrEqual(MAX_LEAVES)
  })

  it('grows every leaf on a short stalk from the surface of a twig', () => {
    const hosts = [...tree.branches, ...tree.twigs]
    const offSurface = (p: Vector3, s: (typeof hosts)[number]) => {
      const line = new Line3(s.start, s.end)
      const t = line.closestPointToPointParameter(p, true)
      return Math.abs(line.at(t, new Vector3()).distanceTo(p) - (s.startRadius + (s.endRadius - s.startRadius) * t))
    }
    for (const leaf of tree.leaves) {
      expect(leaf.position.distanceTo(leaf.twig)).toBeLessThanOrEqual(STALK + 1e-9)
      expect(Math.min(...hosts.filter((s) => s.start.distanceTo(leaf.twig) < 1).map((s) => offSurface(leaf.twig, s)))).toBeLessThan(1e-4)
      const tip = new Vector3(0, 1, 0).applyQuaternion(leaf.quaternion)
      expect(tip.dot(leaf.position.clone().sub(leaf.twig).normalize())).toBeCloseTo(1, 6)
    }
  })

  it('keeps roots below ground and leaves above it', () => {
    for (const root of tree.roots) {
      expect(root.start.y).toBeLessThan(0)
      expect(root.end.y).toBeLessThan(0)
    }
    for (const leaf of tree.leaves) expect(leaf.position.y).toBeGreaterThan(0)
  })

  it('features a fork buried just behind the cut face, on a root that starts at the face', () => {
    const { stem, fork, branch } = featuredRoot(tree.roots)
    expect(stem.at(-1)).toBe(fork)
    expect(branch[0]).toBe(fork)
    expect(branch.length).toBeGreaterThan(2)
    expect(fork.z).toBeGreaterThan(0)
    expect(fork.x).toBeLessThan(-0.2)
    expect(stem[0].x).toBeGreaterThan(-0.24)
  })
})
