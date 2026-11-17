import { describe, expect, it } from 'vitest'
import { featuredRoot, generateTree, MAX_LEAVES } from './tree'

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
